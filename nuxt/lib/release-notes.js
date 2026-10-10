/**
 * The release notes pages, which docgen titles "Release notes" alike.
 *
 * Nine pages with one title cannot be told apart in a search result, and the
 * description a changelog yields is whichever paragraph comes first, which for
 * druxt was a thank-you from 2020. Each page gets its package's name instead.
 */

const { packageName } = require('./site')

/** A package's release notes, keyed by the unprefixed directory docgen uses. */
const RELEASE_NOTES = /^\/api\/packages\/([^/]+)\/CHANGELOG\/?$/

/**
 * The head of a release notes page.
 *
 * @param {string} route - A content route.
 * @returns {?{ pkg: string, title: string, description: string }} The package's
 *   npm name, the page title and its description, or null off those pages.
 */
const releaseNotes = (route, markdown) => {
  const match = RELEASE_NOTES.exec(String(route || ''))
  if (!match) return null
  const pkg = packageName(match[1])
  const latest = latestRelease(markdown)
  const notes = {
    pkg,
    title: `${pkg} release notes`,
    description: `Release notes for ${pkg}: what changed in each version, newest first.`,
    latest,
  }
  if (latest) {
    // The newest version leads, and its first change says what it brought.
    const lead = latest.changes[0] ? `: ${trim(latest.changes[0], 110)}` : ''
    notes.description = `${pkg} ${latest.version}${latest.date ? `, ${latest.date}` : ''}${lead}`
  }
  return notes
}

/** A version heading as changesets writes it: `## 0.25.0 - 2026-10-06`, or the bare version. */
const VERSION_HEADING = /^##\s+(\S+)(?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/

/**
 * The newest release in a changelog: its version, date and changes.
 *
 * The first `##` heading is the newest, as changesets writes them, and its
 * section runs to the next `##`. The `###` kind headings inside it are
 * skipped; every list item is one change, with the links, the commit and
 * the thanks a changeset appends taken off, since a card has no room for
 * them.
 *
 * @param {string} markdown - The changelog body.
 * @returns {?{ version: string, date: ?string, changes: string[] }} The
 *   newest release, or null when the text has no version heading.
 */
const latestRelease = (markdown) => {
  const lines = String(markdown || '').split('\n')
  const start = lines.findIndex((line) => VERSION_HEADING.test(line))
  if (start === -1) return null
  const [, version, date = null] = VERSION_HEADING.exec(lines[start])
  const changes = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break
    const item = /^[-*]\s+(.+)$/.exec(line)
    if (item) changes.push(plain(item[1]))
    else if (changes.length && /^\s+\S/.test(line)) changes[changes.length - 1] += ' ' + plain(line.trim())
  }
  return { version, date, changes: changes.filter(Boolean) }
}

/**
 * One change as plain text: links to their text, code to its text, and the
 * commit reference and the thanks a changeset appends dropped.
 *
 * @param {string} text - A list item's markdown.
 * @returns {string} The sentence.
 */
const plain = (text) =>
  String(text)
    .replace(/\s*\((?:\[[^\]]*\]\([^)]*\)[,\s]*)+\)/g, '')
    .replace(/\s*Thanks\s+\[[^\]]*\]\([^)]*\)\.?/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * A sentence cut to a length, at a word, with an ellipsis.
 *
 * @param {string} text - The sentence.
 * @param {number} max - The longest it may be.
 * @returns {string} The sentence, or its start.
 */
const trim = (text, max) => {
  if (text.length <= max) return text
  const cut = text.slice(0, max + 1).replace(/\s+\S*$/, '')
  return `${cut.replace(/[,;:]$/, '')}\u2026`
}

module.exports = { releaseNotes, latestRelease, trim }
