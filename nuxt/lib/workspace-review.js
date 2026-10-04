/**
 * The review of a workspace: the pages it has changed, read from JSON:API,
 * and the sorting and filtering the review page offers over them.
 *
 * CommonJS so the tests and the page can both require it.
 */

const { SECTIONS, sectionFor } = require('./site')

/** The most changed pages the review lists before pointing at Drupal's overview. */
const CHANGES_LIMIT = 50

/** The orders the review offers, by key. */
const SORTS = {
  newest: { label: 'Newest first', compare: (a, b) => String(b.changed).localeCompare(String(a.changed)) },
  oldest: { label: 'Oldest first', compare: (a, b) => String(a.changed).localeCompare(String(b.changed)) },
  title: { label: 'Title', compare: (a, b) => String(a.title).localeCompare(String(b.title)) },
}

/**
 * The JSON:API query for the pages a workspace has changed, newest first.
 *
 * Each revision records the workspace it was made in, and with the workspace
 * active Drupal reads every page at its revision there, so filtering on that
 * field leaves exactly the pages the workspace has changed. The revision's
 * author comes along, for the card and the filter.
 *
 * @param {string} id - The workspace's machine name.
 * @returns {object} The query parameters.
 */
const changesQuery = (id) => ({
  'filter[workspace.meta.drupal_internal__target_id]': id,
  'fields[node--doc_page]': 'title,path,changed,drupal_internal__nid,revision_uid',
  'fields[user--user]': 'display_name',
  include: 'revision_uid',
  sort: '-changed',
  'page[limit]': CHANGES_LIMIT,
})

/**
 * The changed pages in that query's answer.
 *
 * @param {object} [document] - The JSON:API document.
 * @returns {Array<object>} Each page with its id, title, path, section,
 *   change date, author, and where to review and edit it.
 */
const changesFrom = (document) => {
  const users = new Map(
    ((document && document.included) || [])
      .filter(({ type }) => type === 'user--user')
      .map(({ id, attributes = {} }) => [id, attributes.display_name])
  )
  return ((document && document.data) || []).map(({ id, attributes = {}, relationships = {} }) => {
    const path = (attributes.path || {}).alias || null
    const nid = attributes.drupal_internal__nid
    const author = ((relationships.revision_uid || {}).data || {}).id
    const section = path ? sectionFor(path) : null
    return {
      id,
      title: attributes.title,
      path,
      section,
      sectionLabel: section ? SECTIONS[section].label : 'Other',
      changed: attributes.changed,
      author: (author && users.get(author)) || null,
      review: path ? `${path}?diff=1` : null,
      edit: nid ? `/node/${nid}/edit?destination=${encodeURIComponent('/workspace')}` : null,
    }
  })
}

/**
 * The sections and authors the pages have, for the filters.
 *
 * @param {Array<object>} pages - From changesFrom().
 * @returns {{sections: Array<{value: string, label: string}>, authors: string[]}} The choices.
 */
const facetsOf = (pages) => {
  const sections = new Map()
  const authors = new Set()
  for (const page of pages) {
    sections.set(page.section || 'other', page.sectionLabel)
    if (page.author) authors.add(page.author)
  }
  return {
    sections: [...sections].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    authors: [...authors].sort((a, b) => a.localeCompare(b)),
  }
}

/**
 * The pages a review shows: filtered by text, section and author, then sorted.
 *
 * @param {Array<object>} pages - From changesFrom().
 * @param {object} [options] - What the reader chose.
 * @param {string} [options.text] - Words the title or path must contain.
 * @param {string} [options.section] - A section key, or 'other'.
 * @param {string} [options.author] - An author's display name.
 * @param {string} [options.sort] - A key of SORTS.
 * @returns {Array<object>} A new array.
 */
const reviewOf = (pages, { text = '', section = '', author = '', sort = 'newest' } = {}) => {
  const words = String(text).toLowerCase().split(/\s+/).filter(Boolean)
  const compare = (SORTS[sort] || SORTS.newest).compare
  return pages
    .filter((page) => !section || (page.section || 'other') === section)
    .filter((page) => !author || page.author === author)
    .filter((page) => {
      const haystack = `${page.title} ${page.path || ''}`.toLowerCase()
      return words.every((word) => haystack.includes(word))
    })
    .sort(compare)
}

/**
 * Drupal's own overview of a workspace, where it is also published.
 *
 * @param {string} id - The workspace's machine name.
 * @returns {string} The path, on this origin through the admin proxy.
 */
const overviewPath = (id) => `/admin/config/workflow/workspaces/manage/${encodeURIComponent(id)}`

module.exports = { CHANGES_LIMIT, SORTS, changesFrom, changesQuery, facetsOf, overviewPath, reviewOf }
