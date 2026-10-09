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

module.exports = { PREVIEW_INCLUDE, previewRequest }
