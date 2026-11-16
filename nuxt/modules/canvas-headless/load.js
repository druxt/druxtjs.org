/**
 * Reads a Canvas page and the state of this request's draft session.
 *
 * On the server the module's middleware has the request and reads both. In
 * the browser they come from its routes, with the session's cookies.
 *
 * @param {string} path - The page's path in Drupal.
 * @param {object} [req] - The request, on the server.
 * @returns {Promise<{page: object|null, session: object}>} The page as the
 *   content API answers this request, and the session's state.
 */
export default async function load(path, req) {
  if (req) return req.canvasHeadless.load(path)
  const get = (url) =>
    fetch(url, { credentials: 'same-origin' }).then((response) => (response.ok ? response.json() : null))
  const [page, session] = await Promise.all([
    get(`/api/canvas/page?path=${encodeURIComponent(path)}`),
    get('/api/draft/session'),
  ])
  return { page, session: session || { enabled: false } }
}
