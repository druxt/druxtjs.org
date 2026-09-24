// A copy of druxt-auth's templates/drupal-scheme.js from druxt/druxt-auth#69,
// until a release carries it. Keep the two identical.

import { Oauth2Scheme } from '~auth/runtime'

/**
 * The authorization code grant, with a sign-in form of the site's own.
 *
 * Plain `oauth2` sends the browser to Drupal's authorize page, which sends an
 * anonymous visitor on to Drupal's login form. This scheme signs in first,
 * through Drupal's JSON login, so the authorize step finds a session and a
 * consumer set to approve automatically returns straight away: the visitor
 * never sees a Drupal page.
 *
 * The session cookie has to reach the authorize request, so both must be on
 * one origin: proxy `/user/login`, `/user/logout`, `/user/password` and
 * `/oauth/authorize` onto the site and point the `authorization` endpoint at
 * the site. Without credentials, `login()` is `oauth2`'s own.
 */

const DEFAULTS = {
  name: 'drupal',
  endpoints: {
    drupalLogin: '/user/login?_format=json',
    drupalLogout: '/user/logout?_format=json',
    passwordReset: '/user/password?_format=json',
    csrfToken: '/session/token',
    // A backend route that ends whatever session the request carries, taking
    // the `X-CSRF-Token` header. Drupal issues the logout token only at login,
    // so without a route like this a session the frontend did not start cannot
    // be ended at all. Core has none, so there is no default: a site that adds
    // one names it here.
    sessionLogout: null,
  },
}

export default class DrupalScheme extends Oauth2Scheme {
  constructor ($auth, options, ...defaults) {
    super($auth, options, ...defaults, DEFAULTS)
  }

  /** The storage key for the token Drupal's JSON logout wants. */
  get logoutTokenKey () {
    return this.name + '.logout_token'
  }

  /**
   * Signs in to Drupal with credentials when given them, then starts the
   * authorization code flow.
   *
   * Drupal refuses a JSON login while a session is open, so a browser that
   * still holds one would be authorized as whoever left it there rather than
   * as whoever typed these credentials. The authorize step is a redirect, so
   * nothing after it runs and there is no later point to check at.
   *
   * So an open session is ended and the credentials tried again, which signs
   * the reader in as themselves whoever the session belonged to. Their own
   * leftover session, from a sign-in that went no further than Drupal, stops
   * locking them out; a stranger's is closed rather than borrowed. Only a
   * session that cannot be ended is refused, because reusing it would hand
   * this reader the other one's account.
   *
   * @param {object} [options] - oauth2's login options, plus `credentials`.
   * @param {object} [options.credentials] - `{ name, pass }`.
   * @throws {Error} When a session is open and will not end, with `sessionInUse` set.
   */
  async login ({ credentials, ...options } = {}) {
    if (!credentials) {
      return super.login(options)
    }
    if (await this.drupalLogin(credentials)) {
      const ended = await this.drupalLogout()
      if (!ended || (await this.drupalLogin(credentials))) {
        const error = new Error(
          'Somebody else is still signed in on this browser. Sign out, then sign in again.'
        )
        error.sessionInUse = true
        throw error
      }
    }
    return super.login(options)
  }

  /**
   * Starts a Drupal session through its JSON login.
   *
   * A session that is already signed in answers 403. Drupal will not replace
   * it, so it is reused and `login()` checks afterwards whose it is.
   *
   * @param {object} credentials - `{ name, pass }`.
   * @returns {Promise<boolean>} True when an open session was reused rather than started.
   */
  async drupalLogin ({ name, pass }) {
    try {
      const { data } = await this.$auth.request({
        method: 'post',
        baseURL: '',
        url: this.options.endpoints.drupalLogin,
        data: { name, pass },
        withCredentials: true,
      })
      if (data && data.logout_token) {
        this.$auth.$storage.setUniversal(this.logoutTokenKey, data.logout_token)
      }
      return false
    } catch (error) {
      const { status, data } = error.response || {}
      if (status === 403 && /anonymous users/i.test((data || {}).message || '')) {
        return true
      }
      throw error
    }
  }

  /**
   * Ends the Drupal session this scheme started, when there is one.
   *
   * The token is kept unless Drupal answered, because an answer of any kind
   * means the session is not there to end, while a request that never arrived
   * says nothing. Dropping it then would leave the session open with nothing
   * left to prove it was ours, and the next sign-in would read it as a
   * stranger's and refuse.
   *
   * @returns {Promise<boolean>} True when the session is known to be over.
   */
  async drupalLogout () {
    const token = this.$auth.$storage.getUniversal(this.logoutTokenKey)
    if (!token) {
      return this.endSession()
    }
    let ended = true
    try {
      await this.$auth.request({
        method: 'post',
        baseURL: '',
        url: this.options.endpoints.drupalLogout,
        params: { token },
        // The session is the cookie's. A bearer token, possibly revoked
        // already, would have Drupal authenticate that instead and refuse.
        headers: { Authorization: '' },
        withCredentials: true,
      })
    } catch (error) {
      ended = Boolean(error.response)
    }
    if (ended) {
      this.$auth.$storage.removeUniversal(this.logoutTokenKey)
    }
    return ended
  }

  /**
   * Ends a session this scheme has no logout token for.
   *
   * That is any session it did not start: one left open on a shared browser,
   * or one from a sign-in that reached Drupal and then went no further. The
   * `X-CSRF-Token` header proves the caller is a page on this origin holding
   * the session, which is the same proof core takes for its own writes.
   *
   * @returns {Promise<boolean>} True when the session is known to be over.
   */
  async endSession () {
    const { csrfToken, sessionLogout } = this.options.endpoints
    if (!sessionLogout) {
      return false
    }
    try {
      const { data } = await this.$auth.request({
        method: 'get',
        baseURL: '',
        url: csrfToken,
        headers: { Authorization: '' },
        withCredentials: true,
      })
      await this.$auth.request({
        method: 'delete',
        baseURL: '',
        url: sessionLogout,
        headers: { Authorization: '', 'X-CSRF-Token': String(data).trim() },
        withCredentials: true,
      })
      return true
    } catch (error) {
      // Drupal refusing means there is no session of its own left to end. A
      // request that never arrived says nothing, so it is not treated as one.
      return Boolean(error.response)
    }
  }

  /**
   * Ends the Drupal session too, when this scheme started one, then signs
   * out the way oauth2 does.
   */
  async logout () {
    await this.drupalLogout()
    return super.logout()
  }

  /**
   * Asks Drupal to email a password reset link. Drupal answers the same
   * whether or not the address has an account.
   *
   * @param {string} mail - The address, or the account name.
   */
  async resetPassword (mail) {
    const body = /@/.test(mail) ? { mail } : { name: mail }
    await this.$auth.request({
      method: 'post',
      baseURL: '',
      url: this.options.endpoints.passwordReset,
      data: body,
      withCredentials: true,
    })
  }
}
