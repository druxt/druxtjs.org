import { headingId } from './headings.js'

/**
 * Troubleshooting issues: the docs_issue nodes the troubleshooting page
 * lists by area, through the docs_issues view.
 *
 * The areas are field_issue_area's allowed values, in its order. The tests
 * keep this list equal to the field's storage config.
 */
export const AREAS = [
  { value: 'install', label: 'Install and build' },
  { value: 'backend', label: 'Drupal backend' },
  { value: 'routing', label: 'Pages and routing' },
  { value: 'stale', label: 'Stale or changed content' },
]

export const ISSUE_TYPE = 'node--docs_issue'

/** The page every issue is listed on, and whose child route opens one. */
export const ISSUES_PATH = '/how-to/troubleshooting'

/**
 * Whether a path is the troubleshooting page, with or without an issue open.
 *
 * @param {string} path - A route's path.
 * @returns {boolean} True for the page and each issue's URL.
 */
export const onIssuesPage = (path) => path === ISSUES_PATH || String(path).startsWith(`${ISSUES_PATH}/`)

/**
 * The views page the list keeps in the URL: the search, which the view
 * runs, with the open issue as a param the page owns.
 */
export const ISSUES_PAGE = {
  pattern: `${ISSUES_PATH}/:issue?`,
  viewId: 'docs_issues',
  displayId: 'default',
  filters: { q: { query: 'q' } },
  history: 'replace',
}

/**
 * The query key for the area. The list filters the view's results by area
 * itself, so each area's count is known from one response.
 */
export const AREA_KEY = 'area'

/**
 * The area a route names, or an empty string for all of them.
 *
 * @param {object} query - The route's query.
 * @returns {string} One of AREAS' values, or an empty string.
 */
export const areaFromQuery = (query = {}) => {
  const value = String(query[AREA_KEY] || '')
  return AREAS.some((area) => area.value === value) ? value : ''
}

/**
 * The area chips: All, then each area the issues have, with its count and
 * the location that picks it.
 *
 * A chip keeps the open issue's URL only when its area still lists that
 * issue, and goes to the page's URL otherwise, so no URL names an issue
 * the list hides.
 *
 * @param {Array<object>} issues - Issues from issueOf().
 * @param {string} active - The area picked, or an empty string.
 * @param {object} route - The current route, `{ path, query, params }`.
 * @returns {Array<object>} `{ value, label, count, active, to }` each.
 */
export const chipsOf = (issues, active, route) => {
  const slug = String((route.params || {}).issue || '')
  const open = slug && issues.find((issue) => issue.slug === slug)
  const to = (value) => {
    const query = { ...(route.query || {}) }
    if (value) query[AREA_KEY] = value
    else delete query[AREA_KEY]
    return { path: open && (!value || open.area === value) ? route.path : ISSUES_PATH, query }
  }
  return [{ value: '', label: 'All' }, ...AREAS]
    .map((area) => ({
      ...area,
      count: issues.filter((issue) => !area.value || issue.area === area.value).length,
    }))
    .filter((chip) => !chip.value || chip.count || chip.value === active)
    .map((chip) => ({ ...chip, active: chip.value === active, to: to(chip.value) }))
}

/** The area an issue is in, as groupByArea() files it. */
const areaOf = (entity) => {
  const value = (entity.attributes || {}).field_issue_area || ''
  return AREAS.some((area) => area.value === value) ? value : ''
}

/**
 * An issue's slug: the last segment of its alias, which Drupal's pathauto
 * makes from its title.
 *
 * @param {object} entity - The issue node.
 * @returns {string} The slug, or an empty string without an alias.
 */
export const slugOf = (entity) => {
  const alias = (((entity || {}).attributes || {}).path || {}).alias || ''
  return alias.startsWith(`${ISSUES_PATH}/`) ? alias.slice(ISSUES_PATH.length + 1) : ''
}

/**
 * A title's text and `inline code`, as the parts it renders in.
 *
 * @param {string} title - The title.
 * @returns {Array<{ code: boolean, text: string }>} The parts.
 */
export const segmentsOf = (title) =>
  String(title)
    .split(/(`[^`]+`)/)
    .filter(Boolean)
    .map((part) => (/^`[^`]+`$/.test(part) ? { code: true, text: part.slice(1, -1) } : { code: false, text: part }))

/**
 * One issue node as the list shows it.
 *
 * @param {object} entity - The issue node.
 * @returns {object} `{ entity, slug, title, segments, area, summary }`.
 */
export const issueOf = (entity) => {
  const attributes = entity.attributes || {}
  const title = attributes.title || ''
  return {
    entity,
    slug: slugOf(entity),
    title,
    segments: segmentsOf(title),
    area: areaOf(entity),
    summary: attributes.field_description || '',
  }
}

/**
 * Issues grouped by area, in AREAS order, keeping the order they came in
 * within an area. An issue whose area is not one of them is listed last,
 * under "Other", rather than lost.
 *
 * Each group's id is the one the page's contents gives its heading, which
 * Drupal numbers page-wide when another heading has the same text.
 *
 * @param {Array<object>} issues - Issues from issueOf().
 * @param {Array<object>} [toc] - The page's contents, `{ id, text }` each.
 * @returns {Array<object>} `{ value, label, id, issues }`, without empty groups.
 */
export const groupByArea = (issues, toc = []) => {
  const used = new Set()
  const idFor = (label) => {
    const entry = toc.find((o) => o.text === label && !used.has(o.id))
    if (!entry) return headingId(label)
    used.add(entry.id)
    return entry.id
  }
  return [...AREAS, { value: '', label: 'Other' }]
    .map((area) => ({ ...area, issues: issues.filter((issue) => issue.area === area.value) }))
    .filter((group) => group.issues.length)
    .map((group) => ({ ...group, id: idFor(group.label) }))
}

/**
 * The issue at a path, from the issues the list already put in the Druxt
 * store, so opening one from the list asks Drupal for nothing.
 *
 * @param {object} state - The Druxt store's state.
 * @param {string} path - The issue's URL path.
 * @returns {object|undefined} The issue's attributes, or undefined when the
 *   store has no issue at that path.
 */
export const storedIssue = (state, path) => {
  const stored = ((state || {}).resources || {})[ISSUE_TYPE] || {}
  for (const entry of Object.values(stored)) {
    for (const resource of Object.values(entry || {})) {
      const attributes = ((resource || {}).data || {}).attributes || {}
      if ((attributes.path || {}).alias === path) return attributes
    }
  }
  return undefined
}

/**
 * The URL that opens an issue, keeping the list's filters.
 *
 * @param {string} slug - The issue's slug, or an empty string for none open.
 * @param {object} [query] - The current query.
 * @returns {{ path: string, query: object }} A router location.
 */
export const issueLocation = (slug, query = {}) => ({
  path: slug ? `${ISSUES_PATH}/${slug}` : ISSUES_PATH,
  query: { ...query },
})

/**
 * The issue an old heading link names, from before issues had their own
 * URL: `#<id>` was the id the page's contents gave the issue's title.
 * Drupal's pathauto makes the URL now, by its own rules, so the id is
 * matched against the title's heading id as well as the slug.
 *
 * @param {string} hash - The URL's hash, with or without its `#`.
 * @param {Array<object>} issues - Issues from issueOf().
 * @returns {string} The issue's slug, or an empty string when no issue has it.
 */
export const slugFromHash = (hash, issues) => {
  const id = decodeURIComponent(String(hash || '').replace(/^#/, ''))
  const found = id && issues.find((issue) => issue.slug && (issue.slug === id || headingId(issue.title) === id))
  return found ? found.slug : ''
}
