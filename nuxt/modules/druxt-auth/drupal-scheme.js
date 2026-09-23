// A copy of druxt-auth's templates/drupal-scheme.js from druxt/druxt-auth#69,
// until a release carries it. Keep the two identical, apart from the check
// that the reused Drupal session belongs to whoever typed the credentials,
// which is owed upstream: see `login()` and `isSignedInAs`.

import { Oauth2Scheme } from '~auth/runtime'

import { isSignedInAs } from '~/lib/account'

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
   * A session already open is reused, because Drupal refuses a JSON login
   * while one is. That session belongs to whoever left it there, so when it is
   * reused the account it signed in as is checked against the name that was
   * typed, and a sign-in that landed on somebody else is undone. Without this,
   * the next person to use a shared browser is authorized as the last one.
   *
   * @param {object} [options] - oauth2's login options, plus `credentials`.
   * @param {object} [options.credentials] - `{ name, pass }`.
   */
  async login ({ credentials, ...options } = {}) {
    if (!credentials) {
      return super.login(options)
    }
    const reused = await this.drupalLogin(credentials)
    const result = await super.login(options)
    if (reused && !isSignedInAs(this.$auth.user, credentials.name)) {
      await this.logout()
      throw new Error(
        'Somebody else is still signed in to this browser. Sign them out, then try again.'
      )
    }
    return result
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
   * Ends the Drupal session too, when this scheme started one, then signs
   * out the way oauth2 does.
   */
  async logout () {
    const token = this.$auth.$storage.getUniversal(this.logoutTokenKey)
    if (token) {
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
        // A session that has already ended is the outcome wanted.
      }
      this.$auth.$storage.removeUniversal(this.logoutTokenKey)
    }
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
