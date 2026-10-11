/**
 * A page's revisions, as the Revisions submenu and the viewing pill show them.
 *
 * Revisions come from `/druxt-docs/doc-page/{uuid}/revisions`, newest first:
 * `{ vid, date, state, published, default, latest, author: { name, picture } }`.
 * `default` is the live one; the latest that is not also the default is a
 * pending draft.
 *
 * Plain CommonJS, so the tests import it without the app.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * When a revision was made: the time today, otherwise the date.
 *
 * @param {string} date - An ISO 8601 date.
 * @param {Date} [now] - Today, for tests.
 * @returns {string} Such as `Today, 10:42` or `2 Sep 2026`.
 */
const whenOf = (date, now = new Date()) => {
  const at = new Date(date)
  if (Number.isNaN(at.getTime())) return ''
  if (at.toDateString() === now.toDateString()) {
    return `Today, ${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
  }
  return `${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`
}

/**
 * What a revision is to the reader.
 *
 * @param {object} revision - A revision.
 * @returns {'live'|'draft'|'old'} Its kind.
 */
const kindOf = (revision) => {
  if (revision.default) return 'live'
  if (revision.latest) return 'draft'
  return 'old'
}

/**
 * The editor store's version value that shows a revision.
 *
 * @param {object} revision - A revision.
 * @returns {string} `published`, `working-copy` or `id:<vid>`.
 */
const versionOf = (revision) => ({ live: 'published', draft: 'working-copy' }[kindOf(revision)] || `id:${revision.vid}`)

/**
 * Whether the page has a draft waiting to be published.
 *
 * @param {object[]} revisions - The page's revisions.
 * @returns {boolean} True for a pending draft.
 */
const hasDraft = (revisions) => (revisions || []).some((revision) => kindOf(revision) === 'draft')

/**
 * The revision on screen, from the editor's version.
 *
 * The working copy of a page without a draft is the live page.
 *
 * @param {object[]} revisions - The page's revisions.
 * @param {string} version - The editor store's version.
 * @returns {{ kind: 'live'|'draft'|'old', revision: object|null }} What is shown.
 */
const viewing = (revisions, version) => {
  const list = revisions || []
  const find = (test) => list.find(test) || null
  if (!version || version === 'published') return { kind: 'live', revision: find((r) => r.default) }
  if (version === 'working-copy') {
    const draft = find((r) => kindOf(r) === 'draft')
    return draft ? { kind: 'draft', revision: draft } : { kind: 'live', revision: find((r) => r.default) }
  }
  const vid = Number(String(version).replace(/^id:/, ''))
  const revision = find((r) => r.vid === vid)
  return { kind: revision ? kindOf(revision) : 'old', revision }
}

/**
 * What a row in the list can offer, given what is on screen.
 *
 * Viewing the revision you are already reading does nothing, so the row you
 * are on offers no `view`. The live revision has nothing to compare itself
 * with, so it never offers `diff`.
 *
 * @param {object} revision - The row's revision.
 * @param {object[]} revisions - The page's revisions.
 * @param {string} version - The editor store's version.
 * @returns {Array<'view'|'diff'>} What the row offers.
 */
const actionsFor = (revision, revisions, version) => {
  const shown = viewing(revisions, version).revision || {}
  const current = revision.vid === shown.vid
  const actions = []
  if (!current) actions.push('view')
  if (kindOf(revision) !== 'live') actions.push('diff')
  return actions
}

/** The version a shared URL asks for, or null where it asks for nothing. */
const versionFromQuery = (query = {}) => {
  const asked = String((query || {}).revision || '').trim()
  if (!asked) return null
  if (asked === 'live' || asked === 'published') return 'published'
  if (asked === 'draft' || asked === 'working-copy') return 'working-copy'
  return /^\d+$/.test(asked) ? `id:${asked}` : null
}

/**
 * The query that carries a view, so an editor can send someone the page as
 * they are reading it. The working copy is what an editor sees by default, so
 * it is left out and the URL stays clean.
 *
 * @param {string} version - The editor store's version.
 * @param {boolean} compare - Whether the diff is on.
 * @returns {{ revision?: string, diff?: string }} The query to carry.
 */
const queryFor = (version, compare) => {
  const query = {}
  if (version === 'published') query.revision = 'live'
  else if (/^id:\d+$/.test(String(version))) query.revision = String(version).slice(3)
  if (compare) query.diff = '1'
  return query
}

module.exports = { actionsFor, hasDraft, kindOf, queryFor, versionFromQuery, versionOf, viewing, whenOf }
