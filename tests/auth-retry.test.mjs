// Saving an account in Drupal deletes its access tokens, so a signed-in
// editor's next request is refused while the site still believes it is signed
// in. The refresh token survives the save, so one 401 earns one refresh.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { RETRIED, shouldRefresh } = require('../nuxt/lib/auth-retry.js')

const signedIn = { loggedIn: true, hasRefreshToken: true }
const refused = (config = {}) => ({ response: { status: 401 }, config })

describe('shouldRefresh', () => {
  test('a refused request from a signed-in reader is worth retrying', () => {
    assert.equal(shouldRefresh(refused(), signedIn), true)
  })

  test('a request already retried is not retried again', () => {
    assert.equal(shouldRefresh(refused({ [RETRIED]: true }), signedIn), false)
  })

  test('nothing to refresh with is a real sign-out', () => {
    assert.equal(shouldRefresh(refused(), { loggedIn: true, hasRefreshToken: false }), false)
  })

  test('a reader who is not signed in is not refreshed', () => {
    assert.equal(shouldRefresh(refused(), { loggedIn: false, hasRefreshToken: true }), false)
  })

  test('only a 401: a 403 is Drupal saying no, and a retry would say it again', () => {
    for (const status of [400, 403, 404, 500]) {
      assert.equal(
        shouldRefresh({ response: { status }, config: {} }, signedIn),
        false,
        String(status)
      )
    }
  })

  test('a failure with no answer at all cannot be replayed', () => {
    assert.equal(shouldRefresh({ message: 'Network Error' }, signedIn), false)
    assert.equal(shouldRefresh(refused(null), signedIn), false)
    assert.equal(shouldRefresh(undefined, signedIn), false)
  })
})
