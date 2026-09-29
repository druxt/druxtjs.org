import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { shouldProxy } = await import('../nuxt/modules/druxt-admin/proxy.js')

describe('shouldProxy', () => {
  it('proxies an allowed prefix and its descendants, and nothing beside it', () => {
    assert.equal(shouldProxy('/core/misc/drupal.js'), true)
    assert.equal(shouldProxy('/core'), true)
    assert.equal(shouldProxy('/cores'), false)
    assert.equal(shouldProxy('/node/1'), false)
  })

  // The path goes upstream as it came, so a segment Drupal's server would
  // fold away is refused here rather than resolved past the allowlist.
  it('refuses dot segments, encoded separators and backslashes under an allowed prefix', () => {
    for (const path of [
      '/core/../sites/default/settings.php',
      '/core/../node/1',
      '/core/./../node/1',
      '/core/..',
      '/core/%2e%2e/node/1',
      '/core/%2E%2E/node/1',
      '/core%2f..%2f1',
      '/core/..%5c1',
      '/core/..\\node/1',
    ]) {
      assert.equal(shouldProxy(path), false, path)
    }
  })

  it('ignores the query when deciding', () => {
    assert.equal(shouldProxy('/core/misc/drupal.js?v=1'), true)
    assert.equal(shouldProxy('/node/1?path=/core/x'), false)
  })
})
