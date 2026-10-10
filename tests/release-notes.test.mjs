import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, test } from 'node:test'

const require = createRequire(import.meta.url)
const { releaseNotes, latestRelease, trim } = require('../nuxt/lib/release-notes.js')
const { pageFromDoc } = require('../nuxt/lib/og-pages.js')
const { ogCard } = require('../nuxt/lib/og-card.js')

/** A changelog as changesets writes one: the newest version first, kinds inside it. */
const CHANGELOG = [
  '# druxt-menu',
  '',
  '## 0.21.0 - 2024-01-08',
  '',
  '### Minor Changes',
  '',
  '- Added the `druxtMenu/flushEntities` Vuex mutation, so cached menus can be flushed. ([#684](https://github.com/druxt/druxt.js/issues/684), [`26b1bc6`](https://github.com/druxt/druxt.js/commit/26b1bc6f)) Thanks [@someone](https://github.com/someone).',
  '- Menus keep their place',
  '  across a language switch. ([`14dca08`](https://github.com/druxt/druxt.js/commit/14dca08))',
  '',
  '### Patch Changes',
  '',
  '- Each package exports its `package.json`.',
  '',
  '## 0.20.0 - 2023-11-08',
  '',
  '- Older.',
  '',
].join('\n')

/** Every text node in a Satori element tree, in render order. */
const texts = (node, out = []) => {
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) node.forEach((child) => texts(child, out))
  else if (node && node.props) texts(node.props.children, out)
  return out
}

describe('releaseNotes', () => {
  test('names the package, with druxt itself unprefixed', () => {
    assert.deepEqual(releaseNotes('/api/packages/menu/CHANGELOG'), {
      pkg: 'druxt-menu',
      title: 'druxt-menu release notes',
      description: 'Release notes for druxt-menu: what changed in each version, newest first.',
      latest: null,
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

describe('latestRelease', () => {
  test('reads the newest version, its date and its changes as plain sentences', () => {
    assert.deepEqual(latestRelease(CHANGELOG), {
      version: '0.21.0',
      date: '2024-01-08',
      changes: [
        'Added the druxtMenu/flushEntities Vuex mutation, so cached menus can be flushed.',
        'Menus keep their place across a language switch.',
        'Each package exports its package.json.',
      ],
    })
  })

  test('a snapshot heading has a version and no date', () => {
    assert.deepEqual(latestRelease('# druxt\n\n## 0.25.0-dev.20261006113740\n\n- One change.\n'), {
      version: '0.25.0-dev.20261006113740',
      date: null,
      changes: ['One change.'],
    })
  })

  test('text without a version heading has no release', () => {
    assert.equal(latestRelease('# druxt\n\nNothing yet.\n'), null)
    assert.equal(latestRelease(undefined), null)
  })

  test('the description leads with the newest version and its first change', () => {
    const notes = releaseNotes('/api/packages/menu/CHANGELOG', CHANGELOG)
    assert.equal(
      notes.description,
      'druxt-menu 0.21.0, 2024-01-08: Added the druxtMenu/flushEntities Vuex mutation, so cached menus can be flushed.'
    )
    assert.equal(notes.latest.version, '0.21.0')
  })

  test('trim cuts at a word with an ellipsis, and leaves a short sentence alone', () => {
    assert.equal(trim('A short one.', 20), 'A short one.')
    assert.equal(
      trim('The server keeps the JSON:API index between requests, for a while.', 30),
      'The server keeps the JSON:API\u2026'
    )
  })
})

describe('the og card of a changelog', () => {
  test('leads with the newest version, dated and counted, and its first change', () => {
    const page = pageFromDoc({
      route: '/api/packages/menu/CHANGELOG',
      title: 'Release notes',
      section: 'api',
      content: CHANGELOG,
    })
    assert.equal(page.title, '0.21.0')
    assert.equal(page.pkg, 'druxt-menu')
    assert.equal(page.kind, 'Release notes \u00b7 2024-01-08 \u00b7 3 changes')
    assert.equal(
      page.description,
      'Added the druxtMenu/flushEntities Vuex mutation, so cached menus can be flushed.'
    )
    // The card draws the kind line above the change.
    const all = texts(ogCard(page))
    assert.ok(all.indexOf(page.kind) < all.indexOf(page.description))
    assert.ok(all.includes('0.21.0'))
  })

  test('without a version heading, names the package, with release notes as its kind', () => {
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
