/**
 * The revision a signed-in editor is viewing, expressed as JSON:API's
 * `resourceVersion`. Applied to an individual `node/doc_page` request only:
 * the page's paragraphs are fetched at the revisions the node names, by
 * DocPageFull, because a JSON:API include always returns the default revision.
 *
 * CommonJS so the tests and the plugin can both require it.
 */

/** JSON:API's identifier for the latest revision (the working copy, a draft when one exists). */
const WORKING_COPY = 'rel:working-copy'

/** An individual documentation page: the only resource this adds a version to. */
const PAGE = /\/jsonapi\/node\/doc_page\/[0-9a-f-]{36}$/

/**
 * The `resourceVersion` value for a view, or null for the published default.
 *
 * @param {string} version - 'published', 'working-copy', or 'id:<vid>'.
 * @returns {string|null} The resourceVersion, or null.
 */
const resourceVersionFor = (version) => {
  if (version === 'working-copy') return WORKING_COPY
  if (/^id:\d+$/.test(String(version))) return version
  return null
}

/**
 * A page URL with the view's `resourceVersion`, when it names one and the URL
 * is a page that is not versioned already. Everything else is unchanged.
 *
 * @param {string} url - A JSON:API URL, relative or absolute, with or without a query.
 * @param {string} version - The view: 'published', 'working-copy', or 'id:<vid>'.
 * @returns {string} The URL to request.
 */
const applyVersion = (url, version) => {
  const rv = resourceVersionFor(version)
  const [path, query = ''] = String(url).split('?')
  if (!rv || !PAGE.test(path) || /(^|&)resourceVersion=/.test(query)) return url
  return `${path}?${query ? `${query}&` : ''}resourceVersion=${rv}`
}

module.exports = { WORKING_COPY, applyVersion, resourceVersionFor }
