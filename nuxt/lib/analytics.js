/**
 * Event payload builders for the docs site's GA4 instrumentation.
 *
 * Each returns `[eventName, params]`, ready to spread into `$track`. Kept
 * separate from the dispatcher so the payloads can be asserted directly.
 */

/** GA4 rejects oversized values. */
const MAX_TERM = 100

/**
 * Normalise a search term for aggregation.
 *
 * Lowercased and whitespace-collapsed so "Drupal ", "drupal" and "DRUPAL"
 * report as one row rather than three.
 *
 * @param {string} query - Raw query as typed.
 * @returns {string} The normalised term.
 */
export const normaliseTerm = (query) => String(query || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .slice(0, MAX_TERM)

/**
 * Whether a query is worth reporting.
 *
 * Two characters and under are usually a prefix caught mid-typing.
 *
 * @param {string} query - Raw query as typed.
 * @returns {boolean} True when the term should be sent.
 */
export const isReportableTerm = (query) => normaliseTerm(query).length >= 3

/**
 * Build the search event.
 *
 * Uses GA4's own `search` name and `search_term` parameter, so the built-in
 * site-search reporting picks it up. A zero-result search gets its own name.
 *
 * @param {string} query - Raw query as typed.
 * @param {number} resultsCount - Number of results the query returned.
 * @returns {Array} A two-element `[eventName, params]` pair.
 */
export const searchEvent = (query, resultsCount) => [
  resultsCount > 0 ? 'search' : 'search_no_results',
  { search_term: normaliseTerm(query), results_count: Number(resultsCount) || 0 },
]

/**
 * Build the search-result selection event.
 *
 * `position` is 1-based, across the flattened result list.
 *
 * @param {string} query - Raw query as typed.
 * @param {string} path - Path of the chosen result.
 * @param {number} index - Zero-based index in the flattened result list.
 * @returns {Array} A two-element `[eventName, params]` pair.
 */
export const searchSelectEvent = (query, path, index) => ['search_select', {
  search_term: normaliseTerm(query),
  link_path: path,
  position: Number(index) + 1,
}]

/**
 * Build the code-copy event.
 *
 * The language comes from the highlighter's `language-*` class; unlabelled
 * blocks report `unknown`.
 *
 * @param {string} pagePath - Path of the page holding the block.
 * @param {string} language - Fenced-block language, or a falsy value.
 * @returns {Array} A two-element `[eventName, params]` pair.
 */
export const copyCodeEvent = (pagePath, language) => ['copy_code', {
  page_path: pagePath,
  language: language || 'unknown',
}]

/**
 * Extract the fenced-block language from a `<pre>`'s class list.
 *
 * @param {string} className - The element's className.
 * @returns {string} The language, or an empty string when absent.
 */
export const languageFromClass = (className) => {
  const match = /(?:^|\s)language-([a-z0-9+#-]+)/i.exec(String(className || ''))
  return match ? match[1].toLowerCase() : ''
}

/**
 * Build the 404 event.
 *
 * The referrer says whether the dead URL came from an internal link, an
 * external one, or a search result.
 *
 * @param {string} pagePath - The path that was not found.
 * @param {string} referrer - document.referrer, or an empty string.
 * @returns {Array} A two-element `[eventName, params]` pair.
 */
export const notFoundEvent = (pagePath, referrer) => ['page_not_found', {
  page_path: pagePath,
  referrer: referrer || '(none)',
}]
