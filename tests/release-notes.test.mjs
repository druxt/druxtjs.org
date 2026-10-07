import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, test } from 'node:test'

const require = createRequire(import.meta.url)
const { releaseNotes } = require('../nuxt/lib/release-notes.js')
const { pageFromDoc } = require('../nuxt/lib/og-images.js')

describe('releaseNotes', () => {
  test('names the package, with druxt itself unprefixed', () => {
    assert.deepEqual(releaseNotes('/api/packages/menu/CHANGELOG'), {
      pkg: 'druxt-menu',
      title: 'druxt-menu release notes',
      description: 'Release notes for druxt-menu: what changed in each version, newest first.',
    })
    assert.equal(releaseNotes('/api/packages/druxt/CHANGELOG/').pkg, 'druxt')
  })

  test('is null off the changelog pages', () => {
    for (const route of [
      '/api/packages/menu',
      '/api/packages/menu/components/DruxtMenu',
      '/modules/menu',
      '/api/packages/menu/CHANGELOG/old',
      '',
      undefined,
    ]) {
      assert.equal(releaseNotes(route), null, String(route))
    }
  })
})

describe('the og card of a changelog', () => {
  test('names the package, with release notes as its kind', () => {
    const page = pageFromDoc({
      route: '/api/packages/menu/CHANGELOG',
      title: 'Release notes',
      section: 'api',
    })
    assert.equal(page.title, 'druxt-menu')
    assert.equal(page.kind, 'Release notes')
    assert.equal(page.pkg, 'druxt-menu')
    assert.equal(page.description, undefined)
  })

  test('leaves the other API pages as they were', () => {
    const page = pageFromDoc({
      route: '/api/packages/menu/components/DruxtMenu',
      title: 'DruxtMenu',
      section: 'api',
    })
    assert.equal(page.title, 'DruxtMenu')
    assert.equal(page.kind, 'Component reference')
  })
})
