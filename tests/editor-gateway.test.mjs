import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, test } from 'node:test'

const require = createRequire(import.meta.url)
const { EVERYWHERE, gatewayFor } = require('../nuxt/lib/editor-gateway.js')

/** The keys a set of destinations offers, in order. */
const keys = (path, options) => gatewayFor(path, options).links.map((link) => link.key)

describe('the editor bar on a page Drupal does not hold', () => {
  test("a page gets the backend's own screens, and no note", () => {
    const { note, links } = gatewayFor('/tutorials/getting-started')
    assert.equal(note, null)
    assert.deepEqual(
      links.map((link) => link.key),
      EVERYWHERE.map((link) => link.key)
    )
  })

  // An editor who cannot find the edit button on the API reference should
  // learn there is nothing to find, not keep looking for it.
  test('a generated reference says why it has nothing to edit', () => {
    for (const section of ['api', 'components', 'modules']) {
      const { note } = gatewayFor(`/${section}/druxt-entity`)
      assert.match(note, /generated from the pinned druxt\.js/)
      assert.match(note, new RegExp(section))
    }
  })

  test('a generated reference is not offered a redirect', () => {
    assert.ok(!keys('/api/druxt-entity', { missing: true }).includes('redirect'))
  })

  // A URL with no page behind it is usually one that used to have one.
  test('an address the site could not find offers to redirect itself', () => {
    const { note, links } = gatewayFor('/tutorials/moved-away', { missing: true })
    assert.equal(note, 'Nothing is published at this address.')
    const redirect = links.find((link) => link.key === 'redirect')
    assert.ok(redirect, 'the repair is offered first')
    assert.equal(links[0].key, 'redirect')
    // The form reads `source`, and reads it url-decoded.
    assert.equal(
      redirect.href,
      `/admin/config/search/redirect/add?source=${encodeURIComponent('tutorials/moved-away')}`
    )
  })

  // Most of what Drupal does not hold is still a page: the playground, the
  // section landings, the sign-in. Offering to redirect one of those invites
  // an editor to shadow an address that works.
  test('a page the site renders itself is never offered a redirect', () => {
    for (const path of ['/playground', '/tutorials', '/user/login', '/user/3']) {
      assert.ok(!keys(path).includes('redirect'), path)
      assert.equal(gatewayFor(path).note, null, path)
    }
  })

  test('the query is dropped before the path is offered as the source', () => {
    const { links } = gatewayFor('/tutorials/moved-away?draft=1', { missing: true })
    const redirect = links.find((link) => link.key === 'redirect')
    assert.equal(
      redirect.href,
      `/admin/config/search/redirect/add?source=${encodeURIComponent('tutorials/moved-away')}`
    )
  })

  // The front page is the site's own, and there is nothing to redirect.
  test('the front page is not offered a redirect to itself', () => {
    for (const path of ['/', '']) {
      assert.ok(!keys(path, { missing: true }).includes('redirect'))
    }
  })

  test('every destination is a path on this origin, which the proxy serves', () => {
    for (const path of ['/', '/api/druxt', '/nope']) {
      for (const link of gatewayFor(path).links) {
        assert.match(
          link.href,
          /^\/(admin|node)(\/|\?|$)/,
          `${link.key} is Drupal's, on this origin`
        )
        assert.ok(link.label, `${link.key} says what it is`)
      }
    }
  })
})
