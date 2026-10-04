// Unit tests for the workspace an editor reads the site in: the cookie that
// keeps the choice, and the rule that puts the header on a request.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  CHANGES_LIMIT,
  COOKIE,
  HEADER,
  applyWorkspace,
  changesFrom,
  changesQuery,
  hasBearer,
  isContentRequest,
  isWorkspaceId,
  overviewPath,
  readWorkspace,
  workspaceCookie,
} = require('../nuxt/lib/workspace.js')

const BASE = 'https://cms.example.org'
const editor = (url, workspace = 'stage', baseURL = BASE) =>
  applyWorkspace({}, { signedIn: true, workspace, url, baseURL })

describe('the header', () => {
  test("goes on a signed-in editor's content requests", () => {
    for (const url of [
      '/jsonapi/node/doc_page/aed81db3-eb95-586d-8f04-fdac6bfa3482',
      '/jsonapi/node/doc_page?filter[status]=1',
      `${BASE}/jsonapi/paragraph/docs_text`,
      '/router/translate-path?path=/how-to',
      '/druxt-docs/doc-page/aed81db3-eb95-586d-8f04-fdac6bfa3482/revisions',
    ]) {
      assert.deepEqual(editor(url), { [HEADER]: 'stage' }, url)
    }
  })

  test("never goes on a reader's request, whatever their cookie says", () => {
    const headers = applyWorkspace(
      {},
      { signedIn: false, workspace: 'stage', url: '/jsonapi/node/doc_page', baseURL: BASE }
    )
    assert.deepEqual(headers, {})
  })

  test("is taken off a reader's request that arrives carrying it", () => {
    const headers = applyWorkspace(
      { 'x-druxt-workspace': 'stage', Accept: 'x' },
      { signedIn: false, workspace: null, url: '/jsonapi', baseURL: BASE }
    )
    assert.deepEqual(headers, { Accept: 'x' })
  })

  test('stays off requests that are not for content, and off other hosts', () => {
    for (const url of [
      '/oauth/token',
      '/oauth/userinfo',
      '/user/login',
      'https://api.umami.demo.druxtjs.org/jsonapi',
      '/umami/jsonapi',
      '/jsonapi-other',
    ]) {
      assert.deepEqual(editor(url), {}, url)
    }
  })

  test('stays off when live is chosen or the id could not be one', () => {
    for (const workspace of [null, '', 'Stage', '../stage', 'a b']) {
      assert.deepEqual(editor('/jsonapi/node/doc_page', workspace), {}, String(workspace))
    }
  })
})

describe('the cookie', () => {
  test('keeps a choice for thirty days, and clears it for live', () => {
    assert.equal(workspaceCookie('stage'), `${COOKIE}=stage; Path=/; Max-Age=2592000; SameSite=Lax`)
    assert.equal(
      workspaceCookie('stage', true),
      `${COOKIE}=stage; Path=/; Max-Age=2592000; SameSite=Lax; Secure`
    )
    assert.equal(workspaceCookie(null), `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`)
    assert.equal(workspaceCookie('../x'), `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`)
  })

  test('is read from a Cookie header or document.cookie, and only a valid id counts', () => {
    assert.equal(readWorkspace(`auth.strategy=x; ${COOKIE}=stage; other=1`), 'stage')
    assert.equal(readWorkspace(`${COOKIE}=`), null)
    assert.equal(readWorkspace(`${COOKIE}=Stage`), null)
    assert.equal(readWorkspace(`${COOKIE}=%E0%A4%A`), null)
    assert.equal(readWorkspace(`x${COOKIE}=stage`), null)
    assert.equal(readWorkspace(undefined), null)
  })
})

test('a workspace id is a machine name', () => {
  assert.equal(isWorkspaceId('release_2_0'), true)
  for (const id of ['', 'Stage', 'a-b', 'a b', 'a'.repeat(129), 7, null])
    assert.equal(isWorkspaceId(id), false, String(id))
  assert.equal(isContentRequest('/jsonapi'), true)
})

test('a bearer token is found on the request or in the merged defaults', () => {
  assert.equal(hasBearer({ Authorization: 'Bearer abc' }), true)
  assert.equal(hasBearer({ common: { authorization: 'Bearer abc' }, get: {} }), true)
  for (const headers of [
    {},
    { common: {} },
    { Authorization: 'Bearer ' },
    { Authorization: 'Basic abc' },
    { common: { Authorization: false } },
  ]) {
    assert.equal(hasBearer(headers), false, JSON.stringify(headers))
  }
})

describe('the review of a workspace', () => {
  test('asks for the pages whose revision was made in that workspace, newest first', () => {
    assert.deepEqual(changesQuery('stage'), {
      'filter[workspace.meta.drupal_internal__target_id]': 'stage',
      'fields[node--doc_page]': 'title,path,changed',
      sort: '-changed',
      'page[limit]': CHANGES_LIMIT,
    })
  })

  test('links each changed page to itself with the diff against live on', () => {
    const pages = changesFrom({
      data: [
        {
          id: 'a',
          attributes: {
            title: 'Staged',
            path: { alias: '/how-to/stage' },
            changed: '2026-10-03T00:09:42+00:00',
          },
        },
        {
          id: 'b',
          attributes: {
            title: 'No path yet',
            path: { alias: null },
            changed: '2026-10-02T00:00:00+00:00',
          },
        },
      ],
    })
    assert.deepEqual(pages, [
      {
        id: 'a',
        title: 'Staged',
        path: '/how-to/stage',
        review: '/how-to/stage?diff=1',
        changed: '2026-10-03T00:09:42+00:00',
      },
      {
        id: 'b',
        title: 'No path yet',
        path: null,
        review: null,
        changed: '2026-10-02T00:00:00+00:00',
      },
    ])
  })

  test('reads an empty or missing answer as no changes', () => {
    assert.deepEqual(changesFrom({ data: [] }), [])
    assert.deepEqual(changesFrom(undefined), [])
  })

  test("points at Drupal's overview, where the workspace is published", () => {
    assert.equal(overviewPath('ai_draft'), '/admin/config/workflow/workspaces/manage/ai_draft')
  })
})
