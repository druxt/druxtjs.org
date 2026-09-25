/**
 * The editor sign-in, named once for the auth configuration, the header and
 * the page cache.
 *
 * CommonJS so nuxt.config.js and server/page-cache.js can require it; webpack
 * interop lets components import from it too.
 */

/**
 * The @nuxtjs/auth-next strategy this site signs editors in with.
 *
 * The password grant, through simple_oauth_password_grant: credentials are
 * exchanged for a token by the site's own server, so there is no browser
 * redirect and no Drupal session for the authorize step to find. That removes
 * the whole class of problems the authorization code flow had here, where a
 * session left open in the browser decided who the token belonged to.
 */
const AUTH_STRATEGY = 'drupal-password'

/**
 * The scopes a sign-in asks for: one per role an editor might hold. A token
 * carries only those the account also has, so each person gets their own.
 */
const SCOPES = ['authenticated', 'editor', 'contributor', 'administrator']

/** @nuxtjs/auth-next's cookie prefix, set explicitly so the cookie name below cannot drift. */
const AUTH_COOKIE_PREFIX = 'auth.'

/** The cookie that carries a signed-in editor's token: the prefix, the token key and the strategy. */
const AUTH_COOKIE = `${AUTH_COOKIE_PREFIX}_token.${AUTH_STRATEGY}`

/**
 * Whether a Cookie header carries a token. Signing out leaves the cookie as
 * `false` until it expires, which is not a token.
 *
 * The name is read before the value is decoded, and the decode cannot throw: a
 * client sends any bytes it likes, `%` alone is not valid percent-encoding, and
 * this runs in the page cache's async handler where a throw reaches nothing.
 *
 * @param {string} [header] - The request's Cookie header.
 * @returns {boolean} True when the auth cookie holds a value.
 */
const hasAuthCookie = (header) =>
  String(header || '')
    .split(';')
    .some((pair) => {
      const [name, ...rest] = pair.split('=')
      if (name.trim() !== AUTH_COOKIE) return false
      const raw = rest.join('=').trim()
      let value
      try {
        value = decodeURIComponent(raw)
      } catch (e) {
        // Undecodable: never something @nuxtjs/auth-next wrote, so not a token.
        return false
      }
      return value !== '' && value !== 'false'
    })

/**
 * The storage keys @nuxtjs/auth-next writes for a strategy. Its `reset()`
 * writes the string "false" into these rather than removing them, in cookies
 * and localStorage both, so a real sign-out clears them by hand.
 *
 * @param {string} strategy - The strategy name.
 * @returns {string[]} The keys to clear.
 */
const authStorageKeys = (strategy) => [
  `${AUTH_COOKIE_PREFIX}_token.${strategy}`,
  `${AUTH_COOKIE_PREFIX}_token_expiration.${strategy}`,
  `${AUTH_COOKIE_PREFIX}_refresh_token.${strategy}`,
  `${AUTH_COOKIE_PREFIX}_refresh_token_expiration.${strategy}`,
  `${AUTH_COOKIE_PREFIX}${strategy}.pkce_state`,
  `${AUTH_COOKIE_PREFIX}${strategy}.pkce_code_verifier`,
  `${AUTH_COOKIE_PREFIX}strategy`,
]

module.exports = { AUTH_COOKIE, AUTH_COOKIE_PREFIX, AUTH_STRATEGY, SCOPES, authStorageKeys, hasAuthCookie }
