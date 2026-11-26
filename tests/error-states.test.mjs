// What the error page says for each status: a refused request is never
// called a missing page.
//
//   node --test "tests/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'

const { errorState } = await import('../nuxt/lib/error-states.js')

test('a missing page is not found', () => {
  assert.equal(errorState(404).heading, 'Page not found')
})

test('an expired sign-in and a refused page are named, and not as not found', () => {
  assert.equal(errorState(401).heading, 'Your sign-in has expired')
  assert.equal(errorState(403).heading, 'You cannot see this page')
  for (const status of [401, 403]) assert.doesNotMatch(errorState(status).message, /does not exist/)
})

test('anything else is an unexpected error', () => {
  for (const status of [500, 502, undefined])
    assert.equal(errorState(status).heading, 'Something went wrong')
})
