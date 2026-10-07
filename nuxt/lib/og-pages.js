/**
 * The card facts for each content page, apart from the rendering.
 *
 * og-images.js draws them with satori, which only the generate step installs;
 * this half has no such dependency, so the tests can read it.
 */

const { releaseNotes } = require('./release-notes')
const { packageName } = require('./site')

/** Reference kinds, from the route bucket ApiIndex groups by. */
const KINDS = {
  components: 'Component reference',
  mixins: 'Mixin reference',
  stores: 'Vuex store reference',
}

/**
 * The card facts for one content document.
 *
 * @param {object} doc - A readContent() document: { route, title, description, section }.
 * @returns {object} The ogCard() page object.
 */
const pageFromDoc = (doc) => {
  const parts = doc.route.split('/').filter(Boolean)
  const page = {
    title: doc.title,
    section: doc.section,
    path: doc.route,
    index: parts.length === 1,
    description: doc.description || undefined,
  }

  if (doc.section === 'modules' && parts[1]) {
    page.module = parts[1]
    page.pkg = packageName(parts[1])
  }

  if (doc.section === 'api' && parts[1] === 'packages' && parts[2]) {
    // The generated api tree keys packages by unprefixed slug; the card
    // shows the npm name.
    page.pkg = packageName(parts[2])
    // The package's own module icon is the identity mark on API pages too.
    page.module = parts[2]
    const bucket = parts[3]
    // Component reference pages belong to the Components section, matching
    // the sidebar and breadcrumb.
    if (bucket === 'components' && parts[4]) page.section = 'components'
    // Generated API markdown has no prose worth excerpting; the kind line
    // says what the page is instead.
    page.description = undefined
    page.kind = KINDS[bucket] || 'Reference'
    // The changelog's card names the package, with the kind as its line.
    const notes = releaseNotes(doc.route)
    if (notes) Object.assign(page, { title: notes.pkg, kind: 'Release notes' })
  }

  return page
}

/**
 * The generated image path for a route, relative to the og/ directory.
 *
 * @param {string} route - A content route, e.g. '/modules/entity'.
 * @returns {string} Relative file path, e.g. 'modules/entity.png'.
 */
const ogImageFile = (route) => route.replace(/^\//, '').replace(/\/$/, '') + '.png'

module.exports = { pageFromDoc, ogImageFile }
