import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { versionBadge } = (await import('../nuxt/lib/version.js')).default

describe('versionBadge', () => {
  it('shows a release as it is', () => {
    assert.deepEqual(versionBadge('0.24.0'), {
      label: 'v0.24.0',
      title: 'Druxt 0.24.0 release notes',
    })
  })

  it('shortens a development snapshot, and keeps the build in the title', () => {
    assert.deepEqual(versionBadge('0.25.0-dev.20260921034536'), {
      label: 'v0.25.0-dev',
      title: 'Druxt 0.25.0-dev.20260921034536, built 21 Sep 2026 03:45 UTC: release notes',
    })
  })

  it('leaves another prerelease alone', () => {
    assert.equal(versionBadge('2.0.0-beta.1').label, 'v2.0.0-beta.1')
  })

  it('shows nothing without a version', () => {
    assert.equal(versionBadge(''), null)
    assert.equal(versionBadge(undefined), null)
  })
})
