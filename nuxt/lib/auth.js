/**
 * The editor sign-in, named once for the auth configuration, the header and
 * the page cache.
 *
 * CommonJS so nuxt.config.js and server/page-cache.js can require it; webpack
 * interop lets components import from it too.
 */

/** The @nuxtjs/auth-next strategy druxt-auth registers and this site configures. */
const AUTH_STRATEGY = 'drupal-authorization_code'

/** @nuxtjs/auth-next's cookie prefix, set explicitly so the cookie name below cannot drift. */
const AUTH_COOKIE_PREFIX = 'auth.'

/** The cookie that carries a signed-in editor's token: the prefix, the token key and the strategy. */
const AUTH_COOKIE = `${AUTH_COOKIE_PREFIX}_token.${AUTH_STRATEGY}`

/**
 * Whether a Cookie header carries a token. Signing out leaves the cookie as
 * `false` until it expires, which is not a token.
 *
 * @param {string} [header] - The request's Cookie header.
 * @returns {boolean} True when the auth cookie holds a value.
 */
const hasAuthCookie = (header) =>
  String(header || '')
    .split(';')
    .some((pair) => {
      const [name, ...rest] = pair.split('=')
      const value = decodeURIComponent(rest.join('=').trim())
      return name.trim() === AUTH_COOKIE && value !== '' && value !== 'false'
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

module.exports = { AUTH_COOKIE, AUTH_COOKIE_PREFIX, AUTH_STRATEGY, authStorageKeys, hasAuthCookie }
