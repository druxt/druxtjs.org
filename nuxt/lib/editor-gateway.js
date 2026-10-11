/**
 * Where the editor bar sends someone when the page they are on is not one
 * Drupal holds.
 *
 * Most of this site is Drupal's, and on those pages the bar offers that page's
 * own operations. The rest is not: the API, component and module references
 * are generated from the pinned `druxt.js`, and a URL with nothing behind it
 * is a page Drupal never had. The bar stays on those pages rather than
 * vanishing, and this is what it offers instead, chosen from where the reader
 * is standing rather than from one fixed list.
 *
 * Plain CommonJS with no DOM, so the tests read it without the app.
 */

/** The sections docgen generates, which have no Drupal page behind them. */
const GENERATED = ['api', 'components', 'modules']

/** Drupal's back of house, offered wherever an editor is standing. */
const EVERYWHERE = [
  { key: 'content', href: '/admin/content?type=doc_page', label: 'Documentation pages' },
  { key: 'add', href: '/node/add/doc_page', label: 'New documentation page' },
  { key: 'media', href: '/admin/content/media', label: 'Media' },
  { key: 'admin', href: '/admin', label: 'Administration' },
]

/** The path alone, without the query or the fragment. */
const pathOnly = (path) => String(path || '').split('?')[0].split('#')[0]

/** The first path segment, which is the section. */
const sectionOf = (path) => pathOnly(path).split('/').filter(Boolean)[0] || ''

/**
 * What the bar offers on a page Drupal does not hold.
 *
 * @param {string} path - The route being read.
 * @param {object} [options] - Options.
 * @param {boolean} [options.missing] - Whether this is the error page, rather than a page.
 * @returns {{ note: string|null, links: object[] }} The note to show, and where to go.
 */
const gatewayFor = (path, { missing = false } = {}) => {
  const section = sectionOf(path)
  const generated = GENERATED.includes(section)
  const links = [...EVERYWHERE]
  let note = null

  if (generated) {
    // Saying so is the point: an editor who cannot find the edit button here
    // should learn that there is nothing to find, not keep looking.
    note = `The ${section} reference is generated from the pinned druxt.js, so Drupal has no page for it.`
  } else if (missing && pathOnly(path).replace(/\/+$/, '') !== '') {
    // A URL with no page behind it is usually one that used to have one, and
    // a redirect is the repair. The form takes the source path, so the bar
    // hands it the one the reader is on.
    //
    // Only where the site itself has failed to find a page. Most of what
    // Drupal does not hold is still a page: the playground, the section
    // landings, the sign-in. Offering to redirect one of those invites an
    // editor to shadow a working address.
    note = 'Nothing is published at this address.'
    links.unshift({
      key: 'redirect',
      href: `/admin/config/search/redirect/add?source=${encodeURIComponent(pathOnly(path).replace(/^\//, ''))}`,
      label: 'Redirect this address',
    })
  }

  return { note, links }
}

module.exports = { EVERYWHERE, GENERATED, gatewayFor, sectionOf }
