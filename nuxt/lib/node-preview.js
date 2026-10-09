/**
 * The request for a node preview document.
 *
 * The vendored preview module fetches the JSON:API Node Preview URL with the
 * editor's session, which is right, but outside the Druxt client, so the
 * workspace header its interceptor adds never reaches Drupal. An editor
 * working in a workspace would preview with the page's paragraphs and media
 * read from live. This builds the same request with that header on.
 */

const { HEADER, isWorkspaceId } = require('./workspace')

/**
 * What a preview includes: the page's paragraphs and their media, as a render
 * of the saved page would fetch them.
 */
const PREVIEW_INCLUDE = ['field_content', 'field_content.field_media']

/**
 * The URL and fetch options for a preview document.
 *
 * @param {string} endpoint - The JSON:API Node Preview URL from the fragment.
 * @param {object} [options] - Options.
 * @param {string[]} [options.include] - Relationships to include.
 * @param {string} [options.workspace] - The editor's workspace, if any.
 * @returns {{ url: string, init: object }} What to fetch, and how.
 */
const previewRequest = (endpoint, { include = [], workspace = null } = {}) => {
  let url = String(endpoint || '')
  if (include.length) url += (url.includes('?') ? '&' : '?') + 'include=' + include.join(',')
  const headers = { Accept: 'application/vnd.api+json' }
  if (isWorkspaceId(workspace)) headers[HEADER] = workspace
  return { url, init: { credentials: 'include', headers } }
}

/**
 * Puts the site's page on the preview module's route.
 *
 * The module registers `/druxt/node/preview` with its own page, which draws
 * the entity alone. The route keeps its name and path; only the component
 * changes, so the module's plugin, Drupal's preview URL and the proxy are
 * untouched.
 *
 * @param {object[]} routes - The router's routes, as extendRoutes passes them.
 * @param {string} component - The site's page component path.
 * @returns {object[]} The same routes.
 */
const previewRoute = (routes, component) => {
  for (const route of routes) {
    if (route.name === 'druxt-node-preview') route.component = component
  }
  return routes
}

module.exports = { PREVIEW_INCLUDE, previewRequest, previewRoute }
