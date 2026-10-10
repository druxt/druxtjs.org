/**
 * The card facts for each content page, apart from the rendering.
 *
 * og-images.js draws them with satori, which only the generate step installs;
 * this half has no such dependency, so the tests can read it.
 */

const { releaseNotes, trim } = require('./release-notes')
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
    // The changelog's card leads with the newest version: the version is the
    // title, the kind line says when and how much, and the first change says
    // what. A changelog with no version heading keeps the package's name.
    const notes = releaseNotes(doc.route, doc.content)
    if (notes) {
      const { latest } = notes
      const count = latest ? latest.changes.length : 0
      Object.assign(page, {
        title: latest ? latest.version : notes.pkg,
        kind: latest
          ? ['Release notes', latest.date, count ? `${count} ${count === 1 ? 'change' : 'changes'}` : null].filter(Boolean).join(' \u00b7 ')
          : 'Release notes',
        description: latest && latest.changes[0] ? trim(latest.changes[0], 150) : undefined,
      })
    }
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
