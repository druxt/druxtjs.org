import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createRequire } from 'node:module'

const { badgeOf, titleOf } = createRequire(import.meta.url)('../nuxt/lib/version-badge.js')

describe('the version badge', () => {
  it('names a development build by its tag and keeps the build time for the title', () => {
    assert.equal(badgeOf('0.25.0-dev.20261007123456'), 'v0.25.0-dev')
    assert.equal(titleOf('0.25.0-dev.20261007123456'), 'v0.25.0-dev.20261007123456')
  })

  it('leaves a release version whole', () => {
    assert.equal(badgeOf('0.24.0'), 'v0.24.0')
    assert.equal(titleOf('0.24.0'), 'v0.24.0')
  })

  it('leaves a prerelease without a build time whole', () => {
    assert.equal(badgeOf('1.0.0-beta.1'), 'v1.0.0-beta.1')
  })

  it('is empty without a version', () => {
    assert.equal(badgeOf(null), null)
    assert.equal(badgeOf(''), null)
    assert.equal(titleOf(undefined), null)
  })
})
