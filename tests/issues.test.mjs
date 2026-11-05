// Troubleshooting issues: how a page's Issue blocks become one list, grouped
// by area, with the ids the old headings had.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const { AREAS, ISSUE_TYPE, groupByArea, issueOf, matches, runsOf, segmentsOf } = await import(
  '../nuxt/utils/issues.js'
)

const issue = (id, attributes) => ({ type: ISSUE_TYPE, id, attributes })

describe('AREAS', () => {
  test("is field_issue_area's allowed values, in its order", () => {
    const yaml = readFileSync(
      new URL(
        '../drupal/config/sync/field.storage.paragraph.field_issue_area.yml',
        import.meta.url
      ),
      'utf8'
    )
    const allowed = [...yaml.matchAll(/value: (\S+)\n\s+label: '([^']+)'/g)].map(
      ([, value, label]) => ({ value, label })
    )
    assert.deepEqual(AREAS, allowed)
  })
})

describe('runsOf', () => {
  test('gathers each run of issues into one item, in reading order', () => {
    const runs = runsOf([
      { type: 'paragraph--docs_layout_section', id: 's1' },
      issue('i1', {}),
      issue('i2', {}),
      { type: 'paragraph--docs_layout_section', id: 's2' },
      issue('i3', {}),
    ])
    assert.deepEqual(
      runs.map((run) => (run.issues ? run.issues.map((i) => i.id) : run.paragraph.id)),
      ['s1', ['i1', 'i2'], 's2', ['i3']]
    )
    assert.equal(new Set(runs.map((run) => run.key)).size, runs.length)
  })

  test('numbers an area a second run repeats, as the table of contents does', () => {
    const runs = runsOf([
      issue('i1', { field_issue_area: 'install' }),
      issue('i2', { field_issue_area: 'install' }),
      { type: 'paragraph--docs_layout_section', id: 's1' },
      issue('i3', { field_issue_area: 'install' }),
      issue('i4', { field_issue_area: 'stale' }),
    ]).filter((run) => run.issues)
    const ids = runs.map((run) =>
      groupByArea(run.issues.map(issueOf), run.repeats).map((group) => group.id)
    )
    assert.deepEqual(ids, [
      ['install-and-build'],
      ['install-and-build-1', 'stale-or-changed-content'],
    ])
  })

  test('numbers issues that share a title page-wide, the first keeping the plain id', () => {
    const same = { field_issue_title: 'CORS errors in `nuxt dev`', field_issue_area: 'install' }
    const runs = runsOf([
      issue('i1', same),
      issue('i2', { ...same, field_issue_area: 'backend' }),
      { type: 'paragraph--docs_layout_section', id: 's1' },
      issue('i3', same),
    ]).filter((run) => run.issues)
    const ids = runs.map((run) => run.issues.map((entity) => issueOf(entity, run.ids).id))
    assert.deepEqual(ids, [
      ['cors-errors-in-nuxt-dev', 'cors-errors-in-nuxt-dev-1'],
      ['cors-errors-in-nuxt-dev-2'],
    ])
  })
})

describe('issueOf', () => {
  test('gives an issue the id its title had as a heading', () => {
    const one = issueOf(
      issue('i1', {
        field_issue_title: '"This dependency was not found: druxt" after an npm install',
      })
    )
    assert.equal(one.id, 'this-dependency-was-not-found-druxt-after-an-npm-install')
    const two = issueOf(
      issue('i2', { field_issue_title: 'A production site stops working after `nuxt dev`' })
    )
    assert.equal(two.id, 'a-production-site-stops-working-after-nuxt-dev')
  })

  test('renders `inline code` in a title as code', () => {
    assert.deepEqual(segmentsOf('After `nuxt dev` runs'), [
      { code: false, text: 'After ' },
      { code: true, text: 'nuxt dev' },
      { code: false, text: ' runs' },
    ])
  })
})

describe('groupByArea', () => {
  test('lists the areas in the field order, keeps page order inside one, and loses none', () => {
    const list = [
      issueOf(issue('a', { field_issue_title: 'A', field_issue_area: 'stale' })),
      issueOf(issue('b', { field_issue_title: 'B', field_issue_area: 'install' })),
      issueOf(issue('c', { field_issue_title: 'C', field_issue_area: 'install' })),
      issueOf(issue('d', { field_issue_title: 'D', field_issue_area: 'gone' })),
    ]
    assert.deepEqual(
      groupByArea(list).map((group) => [group.id, group.issues.map((i) => i.title)]),
      [
        ['install-and-build', ['B', 'C']],
        ['stale-or-changed-content', ['A']],
        ['other', ['D']],
      ]
    )
  })
})

describe('matches', () => {
  test('finds every word of a pasted error line, in any order and case', () => {
    const text = 'Access to XMLHttpRequest has been blocked by CORS policy in the browser console'
    assert.ok(matches('blocked by CORS policy', text))
    assert.ok(matches('cors BLOCKED', text))
    assert.ok(matches('', text))
    assert.ok(!matches('cors webpack', text))
  })
})
