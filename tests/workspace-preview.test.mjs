// A reviewer on a workspace preview link: Drupal's cookie, and the server
// render telling the browser about it.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PREVIEW_COOKIE, hasPreviewCookie } = require('../nuxt/lib/workspace-preview.js')

describe('hasPreviewCookie', () => {
  test('the cookie workspace_preview sets, among others', () => {
    assert.equal(PREVIEW_COOKIE, 'workspace_preview')
    assert.equal(hasPreviewCookie('workspace_preview=abc123'), true)
    assert.equal(hasPreviewCookie('SESSx=1; workspace_preview=abc123; druxt-workspace=stage'), true)
  })

  test('not without it, with it empty, or with a cookie that only starts like it', () => {
    for (const cookies of [
      '',
      undefined,
      'SESSx=1',
      'workspace_preview=',
      'workspace_preview_other=1',
      'druxt-workspace=stage',
    ]) {
      assert.equal(hasPreviewCookie(cookies), false, String(cookies))
    }
  })
})
