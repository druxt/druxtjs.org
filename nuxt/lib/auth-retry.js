/**
 * When a request that failed is worth trying again with a fresh token.
 *
 * Drupal deletes an account's access tokens whenever the account is saved,
 * including a save that changed nothing: `simple_oauth_user_update()` revokes
 * them unconditionally. The refresh token survives, so the credential to
 * recover with is still here, but nothing asks for a new access token,
 * because the authentication library only refreshes a token it believes has
 * expired and a token deleted on the server never looks expired.
 *
 * So the trigger is the answer, not the clock: one 401, one refresh, one
 * retry. See https://www.drupal.org/project/simple_oauth/issues/2946882.
 *
 * Plain CommonJS, so the tests read it without the app.
 */

/** The header a retried request carries, so a loop cannot start. */
const RETRIED = '__druxtRetried'

/**
 * Whether a failed request should be retried with a refreshed token.
 *
 * @param {object} error - An axios error.
 * @param {object} state - `{ loggedIn, hasRefreshToken }`.
 * @returns {boolean} True to refresh and try once more.
 */
const shouldRefresh = (error, { loggedIn, hasRefreshToken } = {}) => {
  const { response, config } = error || {}
  if (!response || response.status !== 401) return false
  // No config is a failure the interceptor cannot replay.
  if (!config || config[RETRIED]) return false
  // Nothing to refresh with, or nobody to refresh for.
  return Boolean(loggedIn && hasRefreshToken)
}

module.exports = { RETRIED, shouldRefresh }
