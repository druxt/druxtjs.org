// Unit tests for the review of a workspace: the query that finds its changed
// pages, what a card is made from, and the review's filters and orders.
//
//   node --test "tests/*.test.mjs"

// cspell:ignore Fworkspace

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  CHANGES_LIMIT,
  SORTS,
  changesFrom,
  changesQuery,
  facetsOf,
  overviewPath,
  reviewOf,
} = require('../nuxt/lib/workspace-review.js')

const page = (id, title, alias, changed, author, nid = 1) => ({
  id,
  attributes: { title, path: { alias }, changed, drupal_internal__nid: nid },
  relationships: { revision_uid: { data: author ? { type: 'user--user', id: author } : null } },
})

const document = {
  data: [
    page('a', 'Concepts, as staged', '/explanation', '2026-10-03T00:09:42+00:00', 'u1', 1),
    page('b', 'Stage a page', '/how-to/stage-a-page', '2026-10-02T23:58:29+00:00', 'u2', 39),
    page('c', 'No path yet', null, '2026-10-04T00:00:00+00:00', null, 40),
  ],
  included: [
    { type: 'user--user', id: 'u1', attributes: { display_name: 'Stuart' } },
    { type: 'user--user', id: 'u2', attributes: { display_name: 'Ada' } },
  ],
}

describe('the query', () => {
  test('asks for the pages whose revision was made in that workspace, with their author', () => {
    assert.deepEqual(changesQuery('stage'), {
      'filter[workspace.meta.drupal_internal__target_id]': 'stage',
      'fields[node--doc_page]': 'title,path,changed,drupal_internal__nid,revision_uid',
      'fields[user--user]': 'display_name',
      include: 'revision_uid',
      sort: '-changed',
      'page[limit]': CHANGES_LIMIT,
    })
  })
})

describe('a card', () => {
  const [concepts, staged, pathless] = changesFrom(document)

  test('names the page, its section and who changed it', () => {
    assert.equal(concepts.title, 'Concepts, as staged')
    assert.equal(concepts.section, 'explanation')
    assert.equal(concepts.sectionLabel, 'Concepts')
    assert.equal(staged.author, 'Ada')
  })

  test('reviews the page with its diff on, and edits it coming back to the review', () => {
    assert.equal(staged.review, '/how-to/stage-a-page?diff=1')
    assert.equal(staged.edit, '/node/39/edit?destination=%2Fworkspace')
  })

  test('a page without a path has nothing to review on the site, and can still be edited', () => {
    assert.equal(pathless.review, null)
    assert.equal(pathless.sectionLabel, 'Other')
    assert.equal(pathless.edit, '/node/40/edit?destination=%2Fworkspace')
    assert.equal(pathless.author, null)
  })

  test('reads an empty or missing answer as no changes', () => {
    assert.deepEqual(changesFrom({ data: [] }), [])
    assert.deepEqual(changesFrom(undefined), [])
  })
})

describe('the review', () => {
  const pages = changesFrom(document)

  test('offers the sections and authors the pages have', () => {
    assert.deepEqual(facetsOf(pages), {
      sections: [
        { value: 'explanation', label: 'Concepts' },
        { value: 'how-to', label: 'How-to guides' },
        { value: 'other', label: 'Other' },
      ],
      authors: ['Ada', 'Stuart'],
    })
  })

  test('is newest first by default, and orders by title or oldest on request', () => {
    assert.deepEqual(
      reviewOf(pages).map(({ id }) => id),
      ['c', 'a', 'b']
    )
    assert.deepEqual(
      reviewOf(pages, { sort: 'oldest' }).map(({ id }) => id),
      ['b', 'a', 'c']
    )
    assert.deepEqual(
      reviewOf(pages, { sort: 'title' }).map(({ id }) => id),
      ['a', 'c', 'b']
    )
    assert.deepEqual(Object.keys(SORTS), ['newest', 'oldest', 'title'])
  })

  test('filters by every word against the title and path', () => {
    assert.deepEqual(
      reviewOf(pages, { text: 'stage HOW-TO' }).map(({ id }) => id),
      ['b']
    )
    assert.deepEqual(reviewOf(pages, { text: 'nothing like it' }), [])
  })

  test('filters by section, the pathless pages under other, and by author', () => {
    assert.deepEqual(
      reviewOf(pages, { section: 'other' }).map(({ id }) => id),
      ['c']
    )
    assert.deepEqual(
      reviewOf(pages, { author: 'Stuart' }).map(({ id }) => id),
      ['a']
    )
  })

  test('leaves the pages it was given in their order', () => {
    const before = pages.map(({ id }) => id)
    reviewOf(pages, { sort: 'title' })
    assert.deepEqual(
      pages.map(({ id }) => id),
      before
    )
  })
})

describe("Drupal's overview", () => {
  test('is where the workspace is managed and published', () => {
    assert.equal(overviewPath('ai_draft'), '/admin/config/workflow/workspaces/manage/ai_draft')
  })
})
