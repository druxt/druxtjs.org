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
  hasAuthCookie,
} = require('../nuxt/lib/auth.js')
const { WORKING_COPY, withWorkingCopy } = require('../nuxt/lib/working-copy.js')

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
describe('withWorkingCopy', () => {
  const page = '/jsonapi/node/doc_page/ef19b85f-cdec-55d9-9569-d16dd3f347c6'
  const paragraph =
    'https://cms.example.com/jsonapi/paragraph/docs_text/c2725969-6632-5460-8a9c-02dd768e26a5'

  test('asks for the working copy of a page or a paragraph, relative or absolute', () => {
    assert.equal(withWorkingCopy(page), `${page}?resourceVersion=${WORKING_COPY}`)
    assert.equal(withWorkingCopy(paragraph), `${paragraph}?resourceVersion=${WORKING_COPY}`)
    assert.equal(WORKING_COPY, 'rel:working-copy')
  })

  test('keeps an existing query and appends to it', () => {
    assert.equal(
      withWorkingCopy(`${page}?fields%5Bnode--doc_page%5D=title&include=field_content`),
      `${page}?fields%5Bnode--doc_page%5D=title&include=field_content&resourceVersion=${WORKING_COPY}`
    )
  })

  test('leaves a versioned request alone', () => {
    const versioned = `${page}?resourceVersion=id%3A52`
    assert.equal(withWorkingCopy(versioned), versioned)
  })

  test('leaves collections, other types and the index alone', () => {
    for (const url of [
      '/jsonapi',
      '/jsonapi/node/doc_page',
      '/jsonapi/node/doc_page?filter%5Btitle%5D=x',
      '/jsonapi/paragraph/docs_text',
      '/jsonapi/menu_items/docs',
      '/jsonapi/block/block/1d5e30b7-f2a7-489f-8f7f-d67b105c3cf3',
      '/jsonapi/media/image/1d5e30b7-f2a7-489f-8f7f-d67b105c3cf3',
      '/jsonapi/file/file/1d5e30b7-f2a7-489f-8f7f-d67b105c3cf3',
      `${page}/field_content`,
    ]) {
      assert.equal(withWorkingCopy(url), url, url)
    }
  })
})
