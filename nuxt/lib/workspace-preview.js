/**
 * A reviewer following a workspace preview link.
 *
 * Drupal's workspace_preview module sets a host-only `workspace_preview`
 * cookie when a preview link is followed, and reads the site in that
 * workspace for every request that has it, while the account may preview.
 * The cookie is HttpOnly, so only the server render sees it: the server
 * tells the browser through the store.
 *
 * Plain CommonJS, so the Node server and the root tests import it.
 */

/** The cookie the module's default handler sets. `cookie_name` in its settings. */
const PREVIEW_COOKIE = 'workspace_preview'

/**
 * Whether a Cookie header names a workspace preview.
 *
 * @param {string} [cookies] - A Cookie header.
 * @returns {boolean} True when the preview cookie is present with a value.
 */
const hasPreviewCookie = (cookies) =>
  String(cookies || '')
    .split(/;\s*/)
    .some((pair) => {
      const [name, ...rest] = pair.split('=')
      return name === PREVIEW_COOKIE && rest.join('=') !== ''
    })

module.exports = { PREVIEW_COOKIE, hasPreviewCookie }
