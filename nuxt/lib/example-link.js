/**
 * A docs page's live example, read from the playground link its editor
 * pasted. The card renders from it, and llms-full.txt and the docs server
 * link to it, so both read it here and agree on what it names.
 *
 * Plain CommonJS with no Druxt packages: the production server builds the
 * corpus before the Nuxt app exists. The lists below are the playground's
 * own, kept equal to utils/live-examples.js by the tests.
 */

/** The components that render on their own, the playground's COMPONENT_NAMES. */
const LIVE_COMPONENTS = ['DruxtBlock', 'DruxtBlockRegion', 'DruxtEntity', 'DruxtEntityForm', 'DruxtMenu', 'DruxtView', 'DruxtBreadcrumb', 'DruxtRouter', 'DruxtSite']

/** The site's own backends, the keys of the playground's BACKENDS. */
const BACKEND_IDS = ['site', 'umami', 'mock']

/**
 * The card's state as the playground's query, or null when the link is not
 * a live card. Any of the site's environments will do, and so will a path.
 *
 * The backend is one of the site's own, the mock unless the link names
 * another: a page never sends its readers' browsers to a Drupal an editor
 * typed in, and the mock answers with no backend up at all.
 *
 * @param {string} link - The playground address, `https://druxtjs.org/playground?component=DruxtMenu`.
 * @returns {object|null} The query, `{ component, backend, ...values }`.
 */
const parseExampleLink = (link) => {
  let url
  try {
    url = new URL(String(link || '').trim(), 'https://druxtjs.org')
  } catch (e) {
    return null
  }
  if (url.pathname.replace(/\/+$/, '') !== '/playground') return null
  const { component, backend, ...values } = Object.fromEntries(url.searchParams)
  if (!LIVE_COMPONENTS.includes(component)) return null
  return { component, backend: BACKEND_IDS.includes(backend) ? backend : 'mock', ...values }
}

/**
 * The playground path for a card, as this site links to it.
 *
 * @param {object} query - What parseExampleLink returned.
 * @returns {string} `/playground?component=…`.
 */
const exampleHref = (query) => `/playground?${new URLSearchParams(query)}`

module.exports = { BACKEND_IDS, LIVE_COMPONENTS, exampleHref, parseExampleLink }
