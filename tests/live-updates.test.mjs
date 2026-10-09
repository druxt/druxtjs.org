import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { touchesPage } = require('../nuxt/lib/live-updates.js')

// What the sockets module's matcher answers: the stored entities a purge names.
const page =
  (...matching) =>
  (tags) => ({ entities: tags.filter((tag) => matching.includes(tag)).map((id) => ({ id })) })

describe('touchesPage', () => {
  test('is true for an entity the page loaded', () => {
    assert.equal(touchesPage(['node:7', 'node_list'], page('node:7')), true)
  })

  test('is false for a save elsewhere, whatever list tags it purges', () => {
    assert.equal(touchesPage(['node:9', 'node_list', 'paragraph_list'], page('node:7')), false)
  })

  test('is true for a menu, which every page shows', () => {
    assert.equal(touchesPage(['config:system.menu.docs'], page()), true)
    assert.equal(touchesPage(['menu_link_content:12'], page()), true)
  })

  test('is true for a purge naming nothing in particular', () => {
    assert.equal(touchesPage([], page()), true)
  })
})
