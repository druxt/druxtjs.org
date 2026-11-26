// How the site reads Druxt 0.25.2's failed getResource answers.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const { failedStatus, worthRetrying } = await import('../nuxt/utils/resource-error.js')

describe('failedStatus', () => {
  test('is the status of a failed answer', () => {
    assert.equal(
      failedStatus({ data: null, error: { statusCode: 404, message: 'Not Found' } }),
      404
    )
    assert.equal(failedStatus({ error: { statusCode: '403' } }), 403)
  })

  test('is null for an answer that did not fail', () => {
    for (const resource of [
      undefined,
      null,
      {},
      { data: { id: 'a' } },
      { error: {} },
      { error: { statusCode: 'none' } },
    ]) {
      assert.equal(failedStatus(resource), null)
    }
  })
})

describe('worthRetrying', () => {
  test('is false for a 403 or a 404', () => {
    assert.equal(worthRetrying({ error: { statusCode: 403 } }), false)
    assert.equal(worthRetrying({ error: { statusCode: 404 } }), false)
  })

  test('is true for a server error, a lost request or no answer', () => {
    for (const resource of [
      { error: { statusCode: 500 } },
      { error: { statusCode: 502 } },
      { error: {} },
      undefined,
    ]) {
      assert.equal(worthRetrying(resource), true)
    }
  })
})
