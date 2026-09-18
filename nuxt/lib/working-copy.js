/**
 * The working copy: JSON:API's latest revision of a page, which is its draft
 * when one exists. Asked for on the pages and paragraphs a signed-in editor
 * reads; everything else is served as published.
 *
 * CommonJS so the tests can require it; webpack interop lets the plugin import it.
 */

/** JSON:API's version identifier for the latest revision. */
const WORKING_COPY = 'rel:working-copy'

/** An individual documentation page or paragraph: the only resources asked for as a working copy. */
const DRAFTABLE = /\/jsonapi\/(node\/doc_page|paragraph\/[a-z0-9_]+)\/[0-9a-f-]{36}$/

/**
 * A resource URL with the working copy requested, when it is a draftable
 * resource that is not versioned already. Collections, menus, blocks and
 * files come back untouched.
 *
 * @param {string} url - A JSON:API URL, relative or absolute, with or without a query.
 * @returns {string} The URL to request.
 */
const withWorkingCopy = (url) => {
  const [path, query = ''] = String(url).split('?')
  if (!DRAFTABLE.test(path) || /(^|&)resourceVersion=/.test(query)) return url
  return `${path}?${query ? `${query}&` : ''}resourceVersion=${WORKING_COPY}`
}

module.exports = { WORKING_COPY, withWorkingCopy }
