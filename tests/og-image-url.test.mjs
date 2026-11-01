import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, test } from 'node:test'

const require = createRequire(import.meta.url)
const { ogImageUrl } = require('../nuxt/lib/site.js')

const ROUTER = '/api/packages/router/CHANGELOG'

describe('ogImageUrl', () => {
  test('names the card file for a section page, and nothing elsewhere', () => {
    assert.equal(ogImageUrl('/modules/entity'), 'https://druxtjs.org/og/modules/entity.png')
    assert.equal(ogImageUrl('/guide/'), 'https://druxtjs.org/og/guide.png')
    assert.equal(ogImageUrl('/'), null)
    assert.equal(ogImageUrl('/', ['DruxtJS']), null)
  })

  // Share previews are cached by image URL, so a card drawn anew behind the
  // same URL is never fetched again.
  test('changes when what the card draws changes, and only then', () => {
    const before = ogImageUrl(ROUTER, [
      'druxt-router release notes',
      'druxt-router 0.32.0, 2026-10-23',
    ])
    const same = ogImageUrl(ROUTER, [
      'druxt-router release notes',
      'druxt-router 0.32.0, 2026-10-23',
    ])
    const released = ogImageUrl(ROUTER, [
      'druxt-router release notes',
      'druxt-router 0.32.1, 2026-11-01',
    ])
    const retitled = ogImageUrl(ROUTER, ['Router release notes', 'druxt-router 0.32.0, 2026-10-23'])

    assert.match(
      before,
      /^https:\/\/druxtjs\.org\/og\/api\/packages\/router\/CHANGELOG\.png\?v=[0-9a-z]+$/
    )
    assert.equal(same, before)
    assert.notEqual(released, before)
    assert.notEqual(retitled, before)
  })

  test('keeps fields apart, so moving text between them still changes it', () => {
    assert.notEqual(ogImageUrl('/guide', ['ab', 'c']), ogImageUrl('/guide', ['a', 'bc']))
  })
})
