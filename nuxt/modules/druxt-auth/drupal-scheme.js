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
   * A session this browser started is its own to end: the logout token proves
   * it, because Drupal issues one only at login. That is the sign-in that
   * reached Drupal and then abandoned the redirect, and ending it and starting
   * again is what lets the reader in. Without that, their own leftover session
   * locks them out of every later attempt. Any other session is a stranger's
   * and the sign-in is refused.
   *
   * @param {object} [options] - oauth2's login options, plus `credentials`.
   * @param {object} [options.credentials] - `{ name, pass }`.
   * @throws {Error} When another session is open, with `sessionInUse` set.
   */
  async login ({ credentials, ...options } = {}) {
    if (!credentials) {
      return super.login(options)
    }
    if (await this.drupalLogin(credentials)) {
      // Ours to end, and gone, or this is somebody else's.
      const ours = await this.drupalLogout()
      if (!ours || (await this.drupalLogin(credentials))) {
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
      return false
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
