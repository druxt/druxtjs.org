/**
 * The review of a workspace: the pages it has changed, read from JSON:API,
 * and the search, filters and order the review page offers over them.
 *
 * CommonJS so the tests and the page can both require it.
 */

const { SECTIONS, sectionFor } = require('./site')
const { isAiRevision } = require('./authoring')

/** The most changed pages the review lists before pointing at Drupal's overview. */
const CHANGES_LIMIT = 50

/** The orders the review offers, by key. The first is the default. */
const SORTS = {
  // By the time, not the string: Drupal writes `changed` with the site's
  // offset, and two offsets sort as text in the wrong order.
  newest: { label: 'Newest first', short: 'Newest', compare: (a, b) => (Date.parse(b.changed) || 0) - (Date.parse(a.changed) || 0) },
  oldest: { label: 'Oldest first', short: 'Oldest', compare: (a, b) => (Date.parse(a.changed) || 0) - (Date.parse(b.changed) || 0) },
  title: {
    label: 'Title',
    short: 'Title',
    // Numeric, so "Page 2" comes before "Page 10".
    compare: (a, b) => String(a.title).localeCompare(String(b.title), undefined, { numeric: true }),
  },
}

/** Whether a page is new to live or a change to a page live has. */
const STATUSES = { new: 'New', changed: 'Changed' }

/** The sections in reading order, then pages outside them. */
const SECTION_ORDER = ['tutorials', 'how-to', 'explanation', 'modules', 'api', 'other']

/** No filter at all, and the default order. */
const NO_FILTERS = Object.freeze({ text: '', status: '', section: '', author: '', sort: 'newest' })

/**
 * The JSON:API query for the pages a workspace has changed, newest first.
 *
 * Each revision records the workspace it was made in, and with the workspace
 * active Drupal reads every page at its revision there, so filtering on that
 * field leaves exactly the pages the workspace has changed. The revision's
 * author and log come along, for the row and its filters.
 *
 * @param {string} id - The workspace's machine name.
 * @returns {object} The query parameters.
 */
const changesQuery = (id) => ({
  'filter[workspace.meta.drupal_internal__target_id]': id,
  'fields[node--doc_page]': 'title,path,changed,drupal_internal__nid,revision_uid,revision_log',
  'fields[user--user]': 'display_name',
  include: 'revision_uid',
  sort: '-changed',
  'page[limit]': CHANGES_LIMIT,
})

/**
 * Two letters for an avatar.
 *
 * @param {string} [name] - A display name.
 * @returns {string} Up to two capitals.
 */
const initialsOf = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!words.length) return '?'
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : words[0].slice(0, 2)
  return letters.toUpperCase()
}

/**
 * The changed pages in that query's answer.
 *
 * @param {object} [document] - The JSON:API document.
 * @param {string[]} [created] - The uuids the workspace created, from Drupal.
 * @returns {Array<object>} One row per page.
 */
const changesFrom = (document, created = []) => {
  const users = new Map(
    ((document && document.included) || [])
      .filter(({ type }) => type === 'user--user')
      .map(({ id, attributes = {} }) => [id, attributes.display_name])
  )
  const isNew = new Set(created)
  return ((document && document.data) || []).map(({ id, attributes = {}, relationships = {} }) => {
    const path = (attributes.path || {}).alias || null
    const nid = attributes.drupal_internal__nid
    const author = ((relationships.revision_uid || {}).data || {}).id
    const found = path && sectionFor(path)
    const section = SECTION_ORDER.includes(found) ? found : 'other'
    const name = (author && users.get(author)) || null
    const ai = isAiRevision(attributes.revision_log)
    return {
      id,
      nid,
      title: attributes.title,
      path,
      // The site routes pages by alias; a page without one has nowhere to open.
      href: path,
      section,
      sectionLabel: section === 'other' ? 'Other' : SECTIONS[section].label,
      status: isNew.has(id) ? 'new' : 'changed',
      changed: attributes.changed,
      author: name,
      initials: ai ? 'AI' : initialsOf(name),
      ai,
    }
  })
}

/**
 * Whether a page passes the filters, leaving out one of them.
 *
 * @param {object} page - A row.
 * @param {object} filters - The filters.
 * @param {string} [except] - A filter to ignore, for counting its own values.
 * @returns {boolean} True when it passes.
 */
const passes = (page, filters, except) => {
  const words = String(filters.text || '').toLowerCase().split(/\s+/).filter(Boolean)
  const haystack = `${page.title} ${page.path || ''}`.toLowerCase()
  return (
    (except === 'status' || !filters.status || page.status === filters.status) &&
    (except === 'section' || !filters.section || page.section === filters.section) &&
    (except === 'author' || !filters.author || page.author === filters.author) &&
    words.every((word) => haystack.includes(word))
  )
}

/**
 * The choices each filter offers, every one counted against the other active
 * filters, so a value that would empty the list says 0 and stays choosable.
 *
 * @param {Array<object>} pages - The rows.
 * @param {object} [filters] - The active filters.
 * @returns {{status: object[], sections: object[], authors: object[]}} The choices.
 */
const facetsOf = (pages, filters = NO_FILTERS) => {
  const count = (except, test) => pages.filter((page) => passes(page, filters, except) && test(page)).length
  const authors = new Map()
  for (const page of pages) if (page.author) authors.set(page.author, page)
  return {
    status: [
      { value: '', label: 'All', count: count('status', () => true) },
      ...Object.entries(STATUSES).map(([value, label]) => ({ value, label, count: count('status', (p) => p.status === value) })),
    ],
    sections: [
      { value: '', label: 'All sections', short: 'All', count: count('section', () => true) },
      ...SECTION_ORDER.map((value) => ({
        value,
        label: value === 'other' ? 'Other' : SECTIONS[value].label,
        count: count('section', (p) => p.section === value),
      })),
    ],
    authors: [
      { value: '', label: 'Anyone', count: count('author', () => true) },
      ...[...authors.values()]
        .sort((a, b) => a.author.localeCompare(b.author))
        .map((page) => ({
          value: page.author,
          label: page.author,
          initials: page.initials,
          ai: page.ai,
          count: count('author', (p) => p.author === page.author),
        })),
    ],
  }
}

/**
 * The rows a review shows: filtered, then ordered.
 *
 * @param {Array<object>} pages - The rows.
 * @param {object} [filters] - The active filters.
 * @returns {Array<object>} A new array.
 */
const reviewOf = (pages, filters = NO_FILTERS) =>
  pages.filter((page) => passes(page, filters)).sort((SORTS[filters.sort] || SORTS.newest).compare)

/**
 * How many filters, search aside, narrow the list.
 *
 * @param {object} filters - The active filters.
 * @returns {number} The count the phone's Filters button shows.
 */
const activeFilters = (filters) => ['status', 'section', 'author'].filter((key) => filters[key]).length

/**
 * The filters a query string holds, with anything unknown dropped.
 *
 * @param {object} [query] - The route's query.
 * @returns {object} The filters.
 */
const filtersFrom = (query = {}) => {
  const one = (value) => (Array.isArray(value) ? value[0] : value) || ''
  const status = one(query.status)
  const section = one(query.section)
  const sort = one(query.sort)
  return {
    text: String(one(query.q)).slice(0, 200),
    status: STATUSES[status] ? status : '',
    section: SECTION_ORDER.includes(section) ? section : '',
    author: String(one(query.author)).slice(0, 200),
    sort: SORTS[sort] ? sort : 'newest',
  }
}

/**
 * The query string for the filters, leaving out what is at its default, so
 * an unfiltered review is plain `/workspace`.
 *
 * @param {object} filters - The filters.
 * @returns {object} The query.
 */
const queryOf = (filters) => {
  const query = {}
  if (filters.text) query.q = filters.text
  if (filters.status) query.status = filters.status
  if (filters.section) query.section = filters.section
  if (filters.author) query.author = filters.author
  if (filters.sort && filters.sort !== 'newest') query.sort = filters.sort
  return query
}

/**
 * The summary under the heading.
 *
 * @param {number} shown - Rows the filters leave.
 * @param {number} total - Rows in the workspace.
 * @returns {string} "7 pages differ from live", or "2 of 7 pages differ from live".
 */
const summaryOf = (shown, total) => {
  const pages = total === 1 ? 'page differs' : 'pages differ'
  return shown === total ? `${total} ${pages} from live` : `${shown} of ${total} ${pages} from live`
}

/**
 * When a revision was made, the way the row says it: today and yesterday by
 * name with the time, anything older by date and time.
 *
 * @param {string} date - An ISO 8601 date.
 * @param {Date} [now] - The present, for tests.
 * @returns {string} The phrase, or '' for a date it cannot read.
 */
const whenOf = (date, now = new Date()) => {
  const at = new Date(date)
  if (Number.isNaN(at.getTime())) return ''
  const time = at.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
  const day = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(now) - day(at)) / 86400000)
  if (days === 0) return `Today, ${time}`
  if (days === 1) return `Yesterday, ${time}`
  return `${at.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}, ${time}`
}

/**
 * Drupal's own overview of a workspace, where it is also published.
 *
 * @param {string} id - The workspace's machine name.
 * @returns {string} The path, on this origin through the admin proxy.
 */
const overviewPath = (id) => `/admin/config/workflow/workspaces/manage/${encodeURIComponent(id)}`

/**
 * Where Drupal says which pages a workspace created.
 *
 * @param {string} id - The workspace's machine name.
 * @returns {string} The path, through the content proxy.
 */
const createdPath = (id) => `/druxt-docs/workspace/${encodeURIComponent(id)}/created`

module.exports = {
  CHANGES_LIMIT,
  NO_FILTERS,
  SECTION_ORDER,
  SORTS,
  STATUSES,
  activeFilters,
  changesFrom,
  changesQuery,
  createdPath,
  facetsOf,
  filtersFrom,
  initialsOf,
  overviewPath,
  queryOf,
  reviewOf,
  summaryOf,
  whenOf,
}
