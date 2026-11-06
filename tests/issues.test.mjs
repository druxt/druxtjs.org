// Troubleshooting issues: how the docs_issue nodes the view returns become
// one list, grouped by area, and how an issue's URL is read and written.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const {
  AREAS,
  areaFromQuery,
  chipsOf,
  ISSUE_TYPE,
  ISSUES_PAGE,
  groupByArea,
  issueLocation,
  issueOf,
  segmentsOf,
  slugFromHash,
  storedIssue,
  slugOf,
} = await import('../nuxt/utils/issues.js')

const issue = (id, attributes) => ({ type: ISSUE_TYPE, id, attributes })

describe('AREAS', () => {
  test("is field_issue_area's allowed values, in its order", () => {
    const yaml = readFileSync(
      new URL('../drupal/config/sync/field.storage.node.field_issue_area.yml', import.meta.url),
      'utf8'
    )
    const allowed = [...yaml.matchAll(/value: (\S+)\n\s+label: '([^']+)'/g)].map(
      ([, value, label]) => ({ value, label })
    )
    assert.deepEqual(AREAS, allowed)
  })
})

describe('ISSUES_PAGE', () => {
  test('names each filter it uses by the identifier the view gives it', () => {
    const yaml = readFileSync(
      new URL('../drupal/config/sync/views.view.docs_issues.yml', import.meta.url),
      'utf8'
    )
    const identifiers = [...yaml.matchAll(/^ {12}identifier: (\w+)$/gm)].map(([, id]) => id)
    for (const id of Object.keys(ISSUES_PAGE.filters)) assert.ok(identifiers.includes(id), id)
    assert.match(yaml, new RegExp(`^id: ${ISSUES_PAGE.viewId}$`, 'm'))
  })
})

describe('slugOf', () => {
  test("is the last segment of the issue's alias", () => {
    const cors = issue('a', { path: { alias: '/how-to/troubleshooting/blocked-by-cors-policy-1' } })
    assert.equal(slugOf(cors), 'blocked-by-cors-policy-1')
  })

  test('is empty for an issue without an alias under the troubleshooting page', () => {
    assert.equal(slugOf(issue('a', { path: { alias: null } })), '')
    assert.equal(slugOf(issue('a', { path: { alias: '/node/3' } })), '')
    assert.equal(slugOf(issue('a', {})), '')
  })
})

describe('issueOf', () => {
  test('reads the title, its code, the area, the summary and the slug', () => {
    const one = issueOf(
      issue('a', {
        title: 'After `nuxt dev` runs',
        field_issue_area: 'install',
        field_description: 'The page is blank.',
        path: { alias: '/how-to/troubleshooting/after-nuxt-dev-runs' },
      })
    )
    assert.equal(one.slug, 'after-nuxt-dev-runs')
    assert.equal(one.area, 'install')
    assert.equal(one.summary, 'The page is blank.')
    assert.deepEqual(one.segments, segmentsOf('After `nuxt dev` runs'))
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
  const list = [
    issueOf(issue('a', { title: 'A', field_issue_area: 'stale' })),
    issueOf(issue('b', { title: 'B', field_issue_area: 'install' })),
    issueOf(issue('c', { title: 'C', field_issue_area: 'install' })),
    issueOf(issue('d', { title: 'D', field_issue_area: 'gone' })),
  ]

  test('lists the areas in the field order, keeps view order inside one, and loses none', () => {
    assert.deepEqual(
      groupByArea(list).map((group) => [group.id, group.issues.map((i) => i.title)]),
      [
        ['install-and-build', ['B', 'C']],
        ['stale-or-changed-content', ['A']],
        ['other', ['D']],
      ]
    )
  })

  // Drupal numbers a heading id page-wide, so an area heading after a page
  // heading with the same text is `-1`, and the contents rail links that.
  test("takes each area heading's id from the page's contents", () => {
    const toc = [
      { id: 'install-and-build', text: 'Install and build' },
      { id: 'install-and-build-1', text: 'Install and build' },
      { id: 'stale-or-changed-content', text: 'Stale or changed content' },
    ]
    const used = [{ id: 'install-and-build', text: 'Install and build' }]
    assert.deepEqual(
      groupByArea(list, toc.slice(1)).map((group) => group.id),
      ['install-and-build-1', 'stale-or-changed-content', 'other']
    )
    assert.deepEqual(
      groupByArea(list, [...used, ...used]).map((group) => group.id),
      ['install-and-build', 'stale-or-changed-content', 'other']
    )
  })
})

describe('issueLocation', () => {
  test("opens an issue at its URL, keeping the list's filters", () => {
    assert.deepEqual(issueLocation('cors', { area: 'backend' }), {
      path: '/how-to/troubleshooting/cors',
      query: { area: 'backend' },
    })
  })

  test('closes back to the page', () => {
    assert.deepEqual(issueLocation('', { q: 'cors' }), {
      path: '/how-to/troubleshooting',
      query: { q: 'cors' },
    })
  })
})

describe('slugFromHash', () => {
  const issues = [issueOf(issue('a', { path: { alias: '/how-to/troubleshooting/cors-errors' } }))]

  test('reads an old heading link as the issue with that slug', () => {
    assert.equal(slugFromHash('#cors-errors', issues), 'cors-errors')
    assert.equal(slugFromHash('cors-errors', issues), 'cors-errors')
  })

  test("reads an old heading link by the title's heading id, when pathauto's slug differs", () => {
    const renamed = [
      issueOf(
        issue('b', {
          title: 'The site only shows "Welcome to Nuxt"',
          path: { alias: '/how-to/troubleshooting/site-only-shows-welcome-nuxt' },
        })
      ),
    ]
    assert.equal(
      slugFromHash('#the-site-only-shows-welcome-to-nuxt', renamed),
      'site-only-shows-welcome-nuxt'
    )
    assert.equal(
      slugFromHash('#site-only-shows-welcome-nuxt', renamed),
      'site-only-shows-welcome-nuxt'
    )
  })

  test('ignores a hash no issue has, such as an area heading', () => {
    assert.equal(slugFromHash('#install-and-build', issues), '')
    assert.equal(slugFromHash('', issues), '')
  })
})

describe('areaFromQuery', () => {
  test('reads an area the field allows, and nothing else', () => {
    assert.equal(areaFromQuery({ area: 'backend' }), 'backend')
    assert.equal(areaFromQuery({ area: 'nope' }), '')
    assert.equal(areaFromQuery({}), '')
  })
})

describe('chipsOf', () => {
  const issues = [
    issueOf(issue('a', { field_issue_area: 'install' })),
    issueOf(issue('b', { field_issue_area: 'install' })),
    issueOf(issue('c', { field_issue_area: 'stale' })),
  ]
  const route = { path: '/how-to/troubleshooting', query: { q: 'cors', area: 'stale' }, params: {} }

  test('counts each area the issues have, after All, and keeps the rest of the URL', () => {
    assert.deepEqual(
      chipsOf(issues, 'stale', route).map(({ value, count, active, to }) => [
        value,
        count,
        active,
        to,
      ]),
      [
        ['', 3, false, { path: '/how-to/troubleshooting', query: { q: 'cors' } }],
        [
          'install',
          2,
          false,
          { path: '/how-to/troubleshooting', query: { q: 'cors', area: 'install' } },
        ],
        [
          'stale',
          1,
          true,
          { path: '/how-to/troubleshooting', query: { q: 'cors', area: 'stale' } },
        ],
      ]
    )
  })

  test("keeps an open issue's URL only for All and the issue's own area", () => {
    const listed = [
      issueOf(
        issue('a', { field_issue_area: 'install', path: { alias: '/how-to/troubleshooting/a' } })
      ),
      issueOf(issue('c', { field_issue_area: 'stale' })),
    ]
    const open = { path: '/how-to/troubleshooting/a', query: {}, params: { issue: 'a' } }
    assert.deepEqual(
      chipsOf(listed, '', open).map(({ value, to }) => [value, to.path]),
      [
        ['', '/how-to/troubleshooting/a'],
        ['install', '/how-to/troubleshooting/a'],
        ['stale', '/how-to/troubleshooting'],
      ]
    )
  })

  test('goes to the page for every area when the open issue is not listed', () => {
    const open = { path: '/how-to/troubleshooting/gone', query: {}, params: { issue: 'gone' } }
    assert.deepEqual(
      [...new Set(chipsOf(issues, '', open).map(({ to }) => to.path))],
      ['/how-to/troubleshooting']
    )
  })

  test('keeps the picked area when a search leaves it no issues', () => {
    assert.deepEqual(
      chipsOf([], 'backend', route).map(({ value, count }) => [value, count]),
      [
        ['', 0],
        ['backend', 0],
      ]
    )
  })
})

describe('onIssuesPage', () => {
  test('is the troubleshooting page and each issue URL, nothing else', async () => {
    const { onIssuesPage } = await import('../nuxt/utils/issues.js')
    assert.ok(onIssuesPage('/how-to/troubleshooting'))
    assert.ok(onIssuesPage('/how-to/troubleshooting/cors'))
    assert.ok(!onIssuesPage('/how-to/troubleshooting-other'))
    assert.ok(!onIssuesPage('/how-to'))
  })
})

describe('storedIssue', () => {
  const resource = (id, alias) => ({
    data: { id, type: ISSUE_TYPE, attributes: { title: id, path: { alias } } },
  })
  const state = {
    resources: {
      [ISSUE_TYPE]: {
        a: { undefined: resource('a', '/how-to/troubleshooting/cors') },
        b: { en: resource('b', '/how-to/troubleshooting/stale') },
      },
      'node--doc_page': { c: { undefined: resource('c', '/how-to/troubleshooting/other') } },
    },
  }

  test('finds the issue the list stored at a path, in any language prefix', () => {
    assert.equal(storedIssue(state, '/how-to/troubleshooting/cors').title, 'a')
    assert.equal(storedIssue(state, '/how-to/troubleshooting/stale').title, 'b')
  })

  test("is undefined for a path no stored issue has, such as a renamed issue's old one", () => {
    assert.equal(storedIssue(state, '/how-to/troubleshooting/other'), undefined)
    assert.equal(storedIssue(state, '/how-to/troubleshooting/old-name'), undefined)
    assert.equal(storedIssue({}, '/how-to/troubleshooting/cors'), undefined)
    assert.equal(storedIssue(undefined, '/how-to/troubleshooting/cors'), undefined)
  })
})
