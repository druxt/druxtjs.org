import GithubSlugger from 'github-slugger'
import { headingId } from './headings.js'

/**
 * Troubleshooting issues: the Issue paragraphs a docs page lists by area.
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

export const ISSUE_TYPE = 'paragraph--docs_issue'

/** The area an Issue paragraph is in, as groupByArea() files it. */
const areaOf = (entity) => {
  const value = (entity.attributes || {}).field_issue_area || ''
  return AREAS.some((area) => area.value === value) ? value : ''
}

/** An Issue's title as its heading read, without the code marks. */
const titleText = (entity) => ((entity.attributes || {}).field_issue_title || '').replace(/`/g, '')

/**
 * A page's root paragraphs in reading order, with each run of issues
 * gathered into one item, which the page renders as one list.
 *
 * Each run also counts the earlier runs that listed each area. Drupal's
 * table of contents numbers a repeated heading id page-wide, as
 * github-slugger does, so the second run's "Install and build" is
 * `install-and-build-1`, and the list has to give it that id too.
 *
 * Each issue's id is numbered page-wide the same way, in reading order, so
 * two issues with one title get two ids and the first keeps the old
 * heading's.
 *
 * @param {Array<object>} roots - The page's root paragraphs.
 * @returns {Array<object>} `{ key, paragraph }` or `{ key, issues, repeats, ids }` items.
 */
export const runsOf = (roots) => {
  const runs = []
  for (const paragraph of roots) {
    const last = runs[runs.length - 1]
    if (paragraph.type !== ISSUE_TYPE) runs.push({ key: paragraph.id, paragraph })
    else if (last && last.issues) last.issues.push(paragraph)
    else runs.push({ key: `issues-${paragraph.id}`, issues: [paragraph] })
  }
  const seen = {}
  const slugger = new GithubSlugger()
  for (const run of runs.filter((o) => o.issues)) {
    run.repeats = { ...seen }
    for (const area of new Set(run.issues.map((issue) => areaOf(issue)))) seen[area] = (seen[area] || 0) + 1
    run.ids = Object.fromEntries(run.issues.map((issue) => [issue.id, slugger.slug(titleText(issue))]))
  }
  return runs
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
 * One Issue paragraph as the list shows it.
 *
 * Its id is the one its title had as a heading, so a link to the old
 * heading opens the issue.
 *
 * @param {object} entity - The Issue paragraph.
 * @param {object} [ids] - The page's numbered ids by paragraph uuid, from runsOf().
 * @returns {object} `{ entity, id, title, segments, area, summary }`.
 */
export const issueOf = (entity, ids = {}) => {
  const attributes = entity.attributes || {}
  const title = attributes.field_issue_title || ''
  return {
    entity,
    id: ids[entity.id] || headingId(titleText(entity)),
    title,
    segments: segmentsOf(title),
    area: areaOf(entity),
    summary: attributes.field_issue_summary || '',
  }
}

/**
 * Issues grouped by area, in AREAS order. An issue whose area is not one of
 * them is listed last, under "Other", rather than lost.
 *
 * @param {Array<object>} issues - Issues from issueOf().
 * @param {object} [repeats] - How many earlier runs listed each area, from runsOf().
 * @returns {Array<object>} `{ value, label, id, issues }`, without empty groups.
 */
export const groupByArea = (issues, repeats = {}) =>
  [...AREAS, { value: '', label: 'Other' }]
    .map((area) => ({
      ...area,
      id: headingId(area.label) + (repeats[area.value] ? `-${repeats[area.value]}` : ''),
      issues: issues.filter((issue) => issue.area === area.value),
    }))
    .filter((group) => group.issues.length)

/**
 * Whether text holds every word of a query, in any order and case, so a
 * pasted error line finds its issue.
 *
 * @param {string} query - What the reader typed.
 * @param {string} text - The issue's title, summary and fix.
 * @returns {boolean} True for an empty query.
 */
export const matches = (query, text) => {
  const haystack = String(text).toLowerCase()
  return String(query)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}
