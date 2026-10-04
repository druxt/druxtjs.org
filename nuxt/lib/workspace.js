/**
 * The Drupal workspace a signed-in editor reads the site in.
 *
 * The choice is kept per browser in a cookie, so the server render and the
 * browser read the same one, and reaches Drupal as the X-Druxt-Workspace
 * header on the editor's requests for content. A reader's requests never
 * carry it, and Drupal ignores it from anyone not signed in regardless.
 *
 * CommonJS so the tests and the plugin can both require it.
 */

/** The cookie holding the choice. */
const COOKIE = 'druxt-workspace'

/** The header Drupal negotiates the workspace from. */
const HEADER = 'X-Druxt-Workspace'

/** How long the choice is kept, in seconds: thirty days. */
const MAX_AGE = 60 * 60 * 24 * 30

/** The Drupal routes whose answers depend on the workspace. */
const CONTENT_PATHS = [/^\/jsonapi(\/|$)/, /^\/router\/translate-path(\/|$)/, /^\/druxt-docs\//]

/**
 * Whether a value could be a workspace id: Drupal's machine names.
 *
 * @param {*} id - The value.
 * @returns {boolean} True for a lowercase machine name.
 */
const isWorkspaceId = (id) => typeof id === 'string' && /^[a-z0-9_]{1,128}$/.test(id)

/**
 * The workspace a Cookie header names, or null.
 *
 * @param {string} [cookies] - A Cookie header, or `document.cookie`.
 * @returns {string|null} The workspace id.
 */
const readWorkspace = (cookies) => {
  for (const part of String(cookies || '').split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name !== COOKIE) continue
    let value = rest.join('=')
    try {
      value = decodeURIComponent(value)
    } catch (error) {
      return null
    }
    return isWorkspaceId(value) ? value : null
  }
  return null
}

/**
 * The `document.cookie` assignment that keeps a choice, or clears it for live.
 *
 * @param {string|null} id - The workspace id, or null for live.
 * @param {boolean} [secure] - Whether the page is served over HTTPS.
 * @returns {string} The cookie string.
 */
const workspaceCookie = (id, secure = false) => {
  const value = isWorkspaceId(id) ? id : ''
  const age = value ? MAX_AGE : 0
  return `${COOKIE}=${value}; Path=/; Max-Age=${age}; SameSite=Lax${secure ? '; Secure' : ''}`
}

/**
 * Whether a request is for Drupal content: a path on the site's own origin,
 * or on the backend's, under one of the content routes.
 *
 * @param {string} url - The request URL, relative or absolute.
 * @param {string} [baseURL] - The client's base URL.
 * @returns {boolean} True when the workspace changes the answer.
 */
const isContentRequest = (url, baseURL = '') => {
  let path = String(url || '')
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
    const base = String(baseURL || '').replace(/\/+$/, '')
    if (!base || !path.startsWith(`${base}/`)) return false
    path = path.slice(base.length)
  }
  path = path.split('?')[0]
  return CONTENT_PATHS.some((pattern) => pattern.test(path))
}

/**
 * Whether a request carries a bearer token, wherever axios holds it before
 * sending: on the request, or in the merged defaults under `common`.
 *
 * During a server render the auth module attaches the token before it says
 * the editor is signed in, so the token is the signal, not that flag.
 *
 * @param {object} [headers] - The request's headers, as an interceptor sees them.
 * @returns {boolean} True when a bearer token goes with the request.
 */
const hasBearer = (headers = {}) =>
  [headers, headers.common || {}].some((set) =>
    Object.keys(set).some((name) => name.toLowerCase() === 'authorization' && /^Bearer\s+\S/i.test(String(set[name])))
  )

/**
 * Sets or removes the header on a request's headers, in place.
 *
 * @param {object} headers - The request's headers.
 * @param {object} context - What decides it.
 * @param {boolean} context.signedIn - Whether an editor is signed in.
 * @param {string|null} context.workspace - The chosen workspace.
 * @param {string} context.url - The request URL.
 * @param {string} [context.baseURL] - The client's base URL.
 * @returns {object} The same headers.
 */
const applyWorkspace = (headers, { signedIn, workspace, url, baseURL }) => {
  for (const name of Object.keys(headers)) {
    if (name.toLowerCase() === HEADER.toLowerCase()) delete headers[name]
  }
  if (signedIn && isWorkspaceId(workspace) && isContentRequest(url, baseURL)) headers[HEADER] = workspace
  return headers
}

module.exports = { COOKIE, HEADER, MAX_AGE, applyWorkspace, hasBearer, isContentRequest, isWorkspaceId, readWorkspace, workspaceCookie }
