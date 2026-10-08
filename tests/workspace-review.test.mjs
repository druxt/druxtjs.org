// Unit tests for the review of a workspace: the query that finds its changed
// pages, what a row is made from, and the review's filters, counts and order.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  CHANGES_LIMIT,
  NO_FILTERS,
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
} = require('../nuxt/lib/workspace-review.js')

const page = (id, title, alias, changed, author, { nid = 1, log = null } = {}) => ({
  id,
  attributes: { title, path: { alias }, changed, drupal_internal__nid: nid, revision_log: log },
  relationships: { revision_uid: { data: author ? { type: 'user--user', id: author } : null } },
})

const document = {
  data: [
    page('a', 'Concepts, as staged', '/explanation', '2026-10-03T00:09:42+00:00', 'u1'),
    page('b', 'Stage a page', '/how-to/stage-a-page', '2026-10-02T23:58:29+00:00', 'u2', {
      nid: 39,
      log: 'Written with AI authoring',
    }),
    page('c', 'What a Druxt wrapper is', null, '2026-10-04T00:00:00+00:00', 'u1', { nid: 40 }),
  ],
  included: [
    { type: 'user--user', id: 'u1', attributes: { display_name: 'Stuart Clark' } },
    { type: 'user--user', id: 'u2', attributes: { display_name: 'authoring-bot' } },
  ],
}
const pages = changesFrom(document, ['c'])
const ids = (rows) => rows.map(({ id }) => id)

describe('the query', () => {
  test('asks for the pages whose revision was made in that workspace, with author and log', () => {
    assert.deepEqual(changesQuery('stage'), {
      'filter[workspace.meta.drupal_internal__target_id]': 'stage',
      'fields[node--doc_page]': 'title,path,changed,drupal_internal__nid,revision_uid,revision_log',
      'fields[user--user]': 'display_name',
      include: 'revision_uid',
      sort: '-changed',
      'page[limit]': CHANGES_LIMIT,
    })
  })

  test("asks Drupal which pages the workspace created, and links Drupal's overview", () => {
    assert.equal(createdPath('ai_draft'), '/druxt-docs/workspace/ai_draft/created')
    assert.equal(overviewPath('ai_draft'), '/admin/config/workflow/workspaces/manage/ai_draft')
  })
})

describe('a row', () => {
  const [concepts, staged, pathless] = pages

  test('is new when the workspace created it, and changed otherwise', () => {
    assert.equal(pathless.status, 'new')
    assert.equal(concepts.status, 'changed')
  })

  test('names its section, and puts a page without a path under Other', () => {
    assert.equal(concepts.sectionLabel, 'Concepts')
    assert.equal(staged.section, 'how-to')
    assert.equal(pathless.section, 'other')
  })

  test('links a page by its alias, and a page without one nowhere', () => {
    assert.equal(concepts.href, '/explanation')
    assert.equal(pathless.href, null)
    assert.equal(pathless.nid, 40)
  })

  test('marks a revision whose log says it was written with AI, whichever account saved it', () => {
    assert.equal(staged.ai, true)
    assert.equal(staged.initials, 'AI')
    assert.equal(concepts.ai, false)
    assert.equal(concepts.initials, 'SC')
  })

  test('reads an empty or missing answer as no changes', () => {
    assert.deepEqual(changesFrom({ data: [] }), [])
    assert.deepEqual(changesFrom(undefined), [])
  })
})

describe('initials', () => {
  test('are the first and last names, or the start of one word', () => {
    assert.equal(initialsOf('Stuart Clark'), 'SC')
    assert.equal(initialsOf('authoring-bot'), 'AU')
    assert.equal(initialsOf(''), '?')
  })
})

describe('the filters', () => {
  test('are newest first by default, and order oldest first or by title on request', () => {
    assert.deepEqual(ids(reviewOf(pages)), ['c', 'a', 'b'])
    assert.deepEqual(ids(reviewOf(pages, { ...NO_FILTERS, sort: 'oldest' })), ['b', 'a', 'c'])
    assert.deepEqual(ids(reviewOf(pages, { ...NO_FILTERS, sort: 'title' })), ['a', 'b', 'c'])
  })

  test('order by the time, so a different offset does not reorder the list', () => {
    // As text, a's stamp sorts after b's; as a time it is the earlier one.
    const mixed = changesFrom(
      {
        data: [
          page('a', 'Later as text', '/a', '2026-10-07T23:30:00+10:00', 'u1'),
          page('b', 'Later in time', '/b', '2026-10-07T14:00:00+00:00', 'u1'),
        ],
        included: document.included,
      },
      []
    )
    assert.deepEqual(ids(reviewOf(mixed)), ['b', 'a'])
    assert.deepEqual(ids(reviewOf(mixed, { ...NO_FILTERS, sort: 'oldest' })), ['a', 'b'])
  })

  test('narrow by status, section, author and every searched word', () => {
    assert.deepEqual(ids(reviewOf(pages, { ...NO_FILTERS, status: 'new' })), ['c'])
    assert.deepEqual(ids(reviewOf(pages, { ...NO_FILTERS, section: 'how-to' })), ['b'])
    assert.deepEqual(ids(reviewOf(pages, { ...NO_FILTERS, author: 'Stuart Clark' })), ['c', 'a'])
    assert.deepEqual(ids(reviewOf(pages, { ...NO_FILTERS, text: 'STAGE how-to' })), ['b'])
  })

  test('count each value against the other filters, so an emptying value says 0', () => {
    const facets = facetsOf(pages, { ...NO_FILTERS, status: 'new' })
    const count = (list, value) => list.find((choice) => choice.value === value).count
    assert.equal(count(facets.status, ''), 3)
    assert.equal(count(facets.status, 'changed'), 2)
    assert.equal(count(facets.sections, 'other'), 1)
    assert.equal(count(facets.sections, 'how-to'), 0)
    assert.equal(count(facets.authors, 'authoring-bot'), 0)
  })

  test('offer every section in reading order, and each author once', () => {
    const facets = facetsOf(pages)
    assert.deepEqual(
      facets.sections.map(({ value }) => value),
      ['', 'tutorials', 'how-to', 'explanation', 'modules', 'api', 'other']
    )
    assert.deepEqual(
      facets.authors.map(({ value }) => value),
      ['', 'authoring-bot', 'Stuart Clark']
    )
    assert.equal(facets.authors[1].ai, true)
  })

  test('count the filters the phone button names, search aside', () => {
    assert.equal(activeFilters(NO_FILTERS), 0)
    assert.equal(activeFilters({ ...NO_FILTERS, text: 'x', status: 'new', author: 'Ada' }), 2)
  })
})

describe('the query string', () => {
  test('holds only what differs from the default', () => {
    assert.deepEqual(queryOf(NO_FILTERS), {})
    assert.deepEqual(queryOf({ ...NO_FILTERS, text: 'cors', section: 'api', sort: 'title' }), {
      q: 'cors',
      section: 'api',
      sort: 'title',
    })
  })

  test('round trips, and drops what it does not know', () => {
    const filters = { text: 'cors', status: 'new', section: 'api', author: 'Ada', sort: 'oldest' }
    assert.deepEqual(filtersFrom(queryOf(filters)), filters)
    assert.deepEqual(
      filtersFrom({ status: 'gone', section: 'nowhere', sort: 'random' }),
      NO_FILTERS
    )
  })
})

describe('the summary', () => {
  test('says how many pages differ, and how many of them the filters leave', () => {
    assert.equal(summaryOf(7, 7), '7 pages differ from live')
    assert.equal(summaryOf(2, 7), '2 of 7 pages differ from live')
    assert.equal(summaryOf(1, 1), '1 page differs from live')
  })
})

describe('when a revision was made', () => {
  const now = new Date(2026, 9, 5, 15, 0)

  test('is today or yesterday by name, and older by date, with the time', () => {
    assert.equal(whenOf(new Date(2026, 9, 5, 10, 42).toISOString(), now), 'Today, 10:42')
    assert.equal(whenOf(new Date(2026, 9, 4, 16, 20).toISOString(), now), 'Yesterday, 16:20')
    assert.equal(whenOf(new Date(2026, 9, 1, 14, 30).toISOString(), now), '1 Oct 2026, 14:30')
    assert.equal(whenOf('not a date', now), '')
  })
})
