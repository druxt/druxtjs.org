/**
 * The release notes pages, which docgen titles "Release notes" alike.
 *
 * Nine pages with one title cannot be told apart in a search result, and the
 * description a changelog yields is whichever paragraph comes first, which for
 * druxt was a thank-you from 2020. Each page gets its package's name instead.
 */

/** A package's release notes, keyed by the unprefixed directory docgen uses. */
const { packageName } = require('./site')

const RELEASE_NOTES = /^\/api\/packages\/([^/]+)\/CHANGELOG\/?$/

/**
 * The head of a release notes page.
 *
 * @param {string} route - A content route.
 * @returns {?{ pkg: string, title: string, description: string }} The package's
 *   npm name, the page title and its description, or null off those pages.
 */
const releaseNotes = (route) => {
  const match = RELEASE_NOTES.exec(String(route || ''))
  if (!match) return null
  const pkg = packageName(match[1])
  return {
    pkg,
    title: `${pkg} release notes`,
    description: `Release notes for ${pkg}: what changed in each version, newest first.`,
  }
}

module.exports = { releaseNotes }
