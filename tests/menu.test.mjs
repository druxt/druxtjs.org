// The sidebar: Drupal's docs menu merged with the site's own, where the
// site's generated sections keep the lists it generates.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const { mergeSiteMenu } = await import('../nuxt/utils/menu.js')

const drupal = (title, url, children = []) => ({ entity: { attributes: { title, url } }, children })
const link = (text, to, children = []) => ({ component: 'NuxtLink', text, props: { to }, children })

const site = [
  { ...link('Home', '/'), icon: 'home' },
  {
    ...link('Tutorials', '/tutorials', [link('Getting started', '/tutorials/getting-started')]),
    icon: 'tutorials',
  },
  {
    ...link('Modules', '/modules', [
      link('Druxt', '/modules/druxt'),
      link('Blocks', '/modules/blocks'),
    ]),
    icon: 'modules',
  },
  { ...link('API', '/api', [link('druxt', '/api/packages/druxt')]), icon: 'api' },
]

describe('mergeSiteMenu', () => {
  test('a generated section keeps the site list, whatever Drupal files under it', () => {
    const items = [
      drupal('Modules', '/modules', [
        drupal('Druxt core deprecations', '/modules/druxt/deprecations'),
      ]),
    ]
    const modules = mergeSiteMenu(items, site).find((o) => o.props.to === '/modules')
    assert.deepEqual(
      modules.children.map((o) => o.props.to),
      ['/modules/druxt', '/modules/blocks']
    )
    assert.equal(modules.icon, 'modules')
  })

  test('an authored section takes its pages from Drupal, in Drupal order', () => {
    const items = [
      drupal('Tutorials', '/tutorials', [
        drupal('Authentication', '/tutorials/authentication'),
        drupal('Getting started', '/tutorials/getting-started'),
      ]),
    ]
    const tutorials = mergeSiteMenu(items, site).find((o) => o.props.to === '/tutorials')
    assert.deepEqual(
      tutorials.children.map((o) => o.text),
      ['Authentication', 'Getting started']
    )
  })

  test('a Drupal section without children of its own gets the site ones', () => {
    const tutorials = mergeSiteMenu([drupal('Tutorials', '/tutorials')], site).find(
      (o) => o.props.to === '/tutorials'
    )
    assert.deepEqual(
      tutorials.children.map((o) => o.props.to),
      ['/tutorials/getting-started']
    )
  })

  test('home leads, Drupal sections follow in their order, and what Drupal lacks comes after', () => {
    const merged = mergeSiteMenu(
      [drupal('Modules', '/modules'), drupal('Tutorials', '/tutorials')],
      site
    )
    assert.deepEqual(
      merged.map((o) => o.props.to),
      ['/', '/modules', '/tutorials', '/api']
    )
  })
})
