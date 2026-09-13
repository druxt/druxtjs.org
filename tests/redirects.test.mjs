// Old URLs go where the page went: the pre-restructure paths, the .html
// reference pages, and everything on a package subdomain.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const { PATHS, HOST_PATHS, redirectFor } = (await import('../nuxt/server/redirects.js')).default

describe('redirectFor', () => {
  test('sends the old guide paths to the pages they became, with or without a trailing slash', () => {
    assert.equal(redirectFor('druxtjs.org', '/guide/proxy'), '/how-to/proxy')
    assert.equal(redirectFor('druxtjs.org', '/guide/proxy/'), '/how-to/proxy')
    assert.equal(redirectFor('www.druxtjs.org', '/guide'), '/tutorials')
    assert.equal(
      redirectFor('nuxt.example', '/guide/deprecations.html'),
      '/modules/druxt/deprecations'
    )
  })

  test('keeps the query string', () => {
    assert.equal(
      redirectFor('druxtjs.org', '/guide/theming', '?utm_source=x'),
      '/how-to/theming?utm_source=x'
    )
  })

  test('sends every path on a package subdomain to this site', () => {
    assert.equal(redirectFor('blocks.druxtjs.org', '/'), 'https://druxtjs.org/')
    assert.equal(
      redirectFor('views.druxtjs.org', '/api/components/DruxtView.html'),
      'https://druxtjs.org/api/packages/views/components/DruxtView'
    )
    assert.equal(
      redirectFor('entity.druxtjs.org', '/api/mixins/entity.html'),
      'https://druxtjs.org/api/packages/entity/mixins/entity'
    )
    assert.equal(
      redirectFor('router.druxtjs.org', '/api/mixins/entity.html'),
      'https://druxtjs.org/api/packages/router/mixins/entity'
    )
    assert.equal(
      redirectFor('menu.druxtjs.org:8080', '/anything', '?x=1'),
      'https://druxtjs.org/anything?x=1'
    )
  })

  test("leaves this site's own paths alone", () => {
    assert.equal(redirectFor('druxtjs.org', '/how-to/proxy'), null)
    assert.equal(redirectFor('druxtjs.org', '/'), null)
    assert.equal(redirectFor(undefined, '/api/packages/entity'), null)
  })

  test('every target is a path on this site, never an old name', () => {
    const targets = [
      ...Object.values(PATHS),
      ...Object.values(HOST_PATHS).flatMap((o) => Object.values(o)),
    ]
    for (const to of targets) {
      assert.match(to, /^\/[a-z]/, to)
      assert.doesNotMatch(to, /\.html$|\/$/, to)
    }
  })
})
