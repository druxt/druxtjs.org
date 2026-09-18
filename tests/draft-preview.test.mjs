// Unit tests for the draft preview's pure parts: the auth cookie the page
// cache keys on, and the working-copy rule the client applies when signed in.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  AUTH_COOKIE,
  AUTH_COOKIE_PREFIX,
  AUTH_STRATEGY,
  authStorageKeys,
  hasAuthCookie,
} = require('../nuxt/lib/auth.js')
const { WORKING_COPY, applyVersion, resourceVersionFor } = require('../nuxt/lib/working-copy.js')

describe('auth cookie', () => {
  test('is named as @nuxtjs/auth-next names a token cookie: prefix, _token., strategy', () => {
    assert.equal(AUTH_COOKIE, 'auth._token.drupal-authorization_code')
    assert.equal(AUTH_COOKIE, `${AUTH_COOKIE_PREFIX}_token.${AUTH_STRATEGY}`)
  })

  test('is found in a Cookie header with a token, however it is encoded', () => {
    assert.equal(hasAuthCookie(`${AUTH_COOKIE}=Bearer%20abc.def`), true)
    assert.equal(hasAuthCookie(`auth.strategy=x; ${AUTH_COOKIE}=Bearer abc; other=1`), true)
  })

  test('is not found when absent, empty, signed out, or only similarly named', () => {
    for (const header of [
      undefined,
      '',
      'auth.strategy=drupal-authorization_code',
      `${AUTH_COOKIE}=`,
      `${AUTH_COOKIE}=false`,
      `x${AUTH_COOKIE}=Bearer abc`,
      `${AUTH_COOKIE}x=Bearer abc`,
    ]) {
      assert.equal(hasAuthCookie(header), false, String(header))
    }
  })
})

// cspell:ignore Bnode Btitle
describe('applyVersion', () => {
  const page = '/jsonapi/node/doc_page/ef19b85f-cdec-55d9-9569-d16dd3f347c6'

  test('adds the working copy or a revision id to a page URL', () => {
    assert.equal(applyVersion(page, 'working-copy'), `${page}?resourceVersion=${WORKING_COPY}`)
    assert.equal(applyVersion(page, 'id:52'), `${page}?resourceVersion=id:52`)
    assert.equal(WORKING_COPY, 'rel:working-copy')
  })

  test('leaves a page alone for the published view', () => {
    assert.equal(applyVersion(page, 'published'), page)
    assert.equal(applyVersion(page, 'nonsense'), page)
  })

  test('keeps an existing query and appends to it', () => {
    assert.equal(
      applyVersion(
        `${page}?fields%5Bnode--doc_page%5D=title&include=field_content`,
        'working-copy'
      ),
      `${page}?fields%5Bnode--doc_page%5D=title&include=field_content&resourceVersion=${WORKING_COPY}`
    )
  })

  test('leaves a versioned request alone', () => {
    const versioned = `${page}?resourceVersion=id:52`
    assert.equal(applyVersion(versioned, 'working-copy'), versioned)
  })

  test('adds a version to a page only, never a paragraph, collection or the index', () => {
    for (const url of [
      '/jsonapi',
      '/jsonapi/node/doc_page',
      '/jsonapi/node/doc_page?filter%5Btitle%5D=x',
      '/jsonapi/paragraph/docs_text/c2725969-6632-5460-8a9c-02dd768e26a5',
      '/jsonapi/menu_items/docs',
      '/jsonapi/media/image/1d5e30b7-f2a7-489f-8f7f-d67b105c3cf3',
      `${page}/field_content`,
    ]) {
      assert.equal(applyVersion(url, 'working-copy'), url, url)
    }
  })
})

describe('resourceVersionFor', () => {
  test('maps a view to its JSON:API resourceVersion, or null for published', () => {
    assert.equal(resourceVersionFor('working-copy'), WORKING_COPY)
    assert.equal(resourceVersionFor('id:52'), 'id:52')
    assert.equal(resourceVersionFor('published'), null)
    assert.equal(resourceVersionFor('id:x'), null)
    assert.equal(resourceVersionFor(undefined), null)
  })
})

describe('authStorageKeys', () => {
  test('names every key @nuxtjs/auth-next leaves as "false" on reset, for the strategy', () => {
    const keys = authStorageKeys(AUTH_STRATEGY)
    assert.ok(keys.includes(AUTH_COOKIE))
    assert.ok(keys.includes(`${AUTH_COOKIE_PREFIX}strategy`))
    assert.ok(keys.includes(`${AUTH_COOKIE_PREFIX}${AUTH_STRATEGY}.pkce_code_verifier`))
    // Prefix on every key, and no duplicates.
    assert.ok(keys.every((k) => k.startsWith(AUTH_COOKIE_PREFIX)))
    assert.equal(new Set(keys).size, keys.length)
  })
})
