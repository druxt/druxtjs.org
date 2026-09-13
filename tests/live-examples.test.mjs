// The live example's descriptors: where a select's options come from, what
// each backend offers, and which components a page shows.
//
//   node --test "tests/*.test.mjs"

import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'

const m = await import('../nuxt/utils/live-examples.js')

const jsonapi = (data) => ({ ok: true, json: async () => ({ data }) })
const view = (id, label, base_table, paths) => ({
  attributes: {
    drupal_internal__id: id,
    label,
    base_table,
    display: Object.fromEntries(paths.map((path, i) => [`d${i}`, { display_options: { path } }])),
  },
})

describe('SOURCES', () => {
  let calls
  beforeEach(() => {
    calls = []
    globalThis.fetch = async (url) => {
      calls.push(url)
      if (url.includes('/view/view')) {
        return jsonapi([
          view('admin_audit_trail', 'Admin Audit Trail', 'admin_audit_trail', [
            'admin/reports/audit-trail',
          ]),
          view('content', 'Content', 'node_field_data', ['admin/content']),
          view('recipes', 'Recipes', 'node_field_data', ['recipes']),
          view('frontpage', 'Frontpage', 'node_field_data', ['node', '']),
          view('files', 'Files', 'file_managed', ['admin/content/files']),
        ])
      }
      if (url.includes('/node/recipe'))
        return jsonapi([
          { attributes: { title: 'Borscht', path: { alias: '/recipes/borscht' } } },
          { attributes: { title: 'No alias', path: {} } },
        ])
      if (url.includes('/node/article')) return jsonapi([])
      if (url.includes('/node/page'))
        return jsonapi([{ attributes: { title: 'About', path: { alias: '/about' } } }])
      // The index names the resources a backend has; only Umami has languages.
      if (url === '/jsonapi')
        return { ok: true, json: async () => ({ links: { 'node--doc_page': {} } }) }
      if (url === '/umami/jsonapi')
        return {
          ok: true,
          json: async () => ({ links: { 'configurable_language--configurable_language': {} } }),
        }
      if (url.includes('/configurable_language/')) {
        return jsonapi([
          { attributes: { drupal_internal__id: 'en', label: 'English', locked: false } },
          { attributes: { drupal_internal__id: 'es', label: 'Spanish', locked: false } },
          { attributes: { drupal_internal__id: 'und', label: 'Not specified', locked: true } },
        ])
      }
      if (url.includes('/menu/menu'))
        return jsonapi([{ attributes: { drupal_internal__id: 'main', label: 'Main navigation' } }])
      throw new Error('unexpected ' + url)
    }
  })
  afterEach(() => {
    delete globalThis.fetch
  })

  test('views keeps content views without an admin path, sorted by label', async () => {
    const list = await m.SOURCES.views('/jsonapi')
    assert.deepEqual(
      list.map((o) => o.value),
      ['frontpage', 'recipes']
    )
    assert.equal(list[1].label, 'Recipes (recipes)')
  })

  test('paths list every content type of the backend, grouped, and skip nodes without an alias', async () => {
    const list = await m.SOURCES.paths('/umami/jsonapi', {}, m.BACKENDS.umami)
    assert.deepEqual(list, [
      { value: '/recipes/borscht', label: 'Borscht (/recipes/borscht)', group: 'recipe' },
      { value: '/about', label: 'About (/about)', group: 'page' },
    ])
    assert.match(calls[0], /^\/umami\/jsonapi\/node\/recipe\?/)
  })

  test('languages offers nothing on a backend whose index has none, without asking for it', async () => {
    assert.deepEqual(await m.SOURCES.languages('/jsonapi'), [])
    assert.deepEqual(calls, ['/jsonapi'])
  })

  test('languages lists the unlocked ones on a backend that has them', async () => {
    assert.deepEqual(
      (await m.SOURCES.languages('/umami/jsonapi')).map((o) => o.value),
      ['en', 'es']
    )
  })

  test('menus are labelled the way the Storybook stories name them', async () => {
    assert.deepEqual(await m.SOURCES.menus('/jsonapi'), [
      { value: 'main', label: 'Main navigation (main)' },
    ])
  })
})

describe('the playground page', () => {
  test('site search knows it by every component it renders', async () => {
    const { PAGES } = (await import('../nuxt/lib/site.js')).default
    const page = PAGES.find((p) => p.route === '/playground')
    for (const name of m.COMPONENT_NAMES)
      assert.ok(page.keywords.includes(name), `${name} is not a keyword`)
  })
})

describe('BACKENDS', () => {
  test('each backend names where its options come from and where its runtime sends requests', () => {
    assert.equal(m.BACKENDS.site.api, '/jsonapi')
    assert.equal(m.BACKENDS.site.proxyRoot, '')
    assert.equal(m.BACKENDS.umami.api, '/umami/jsonapi')
    assert.equal(m.BACKENDS.umami.proxyRoot, '/umami')
    assert.equal(m.BACKENDS.umami.baseUrl, 'https://api.umami.demo.druxtjs.org')
  })
})

describe('COMPONENTS', () => {
  test('every live component has a package and an API page', () => {
    for (const name of m.COMPONENT_NAMES)
      assert.match(
        m.pageFor(name),
        new RegExp(`^/api/packages/${m.PACKAGES[name]}/components/${name}$`)
      )
  })

  test('DruxtView is limited to the backend with JSON:API Views, with the reason for the other', () => {
    assert.equal(m.COMPONENTS.DruxtView.backends.umami, true)
    assert.match(m.COMPONENTS.DruxtView.backends.site, /JSON:API Views/)
  })

  test('selects prefer content: nodes, the site menu, the frontend theme of each backend', () => {
    const step = (name, key) => name.chain.steps.find((s) => s.name === key)
    assert.equal(
      step(m.COMPONENTS.DruxtEntity, 'entityType').prefer({ backend: 'site' }),
      'paragraph'
    )
    assert.equal(step(m.COMPONENTS.DruxtEntity, 'entityType').prefer({ backend: 'umami' }), 'node')
    assert.equal(step(m.COMPONENTS.DruxtEntity, 'mode').prefer, 'full')
    const menu = m.COMPONENTS.DruxtMenu.props.find((p) => p.name === 'name')
    assert.equal(menu.prefer({ backend: 'site' }), 'docs')
    assert.equal(menu.prefer({ backend: 'umami' }), 'main')
    const theme = step(m.COMPONENTS.DruxtBlockRegion, 'theme')
    assert.equal(theme.prefer({ backend: 'umami' }), 'umami')
    assert.equal(
      theme.prefer({ backend: 'site', $config: { decoupledTheme: { default: 'druxtjs' } } }),
      'druxtjs'
    )
  })

  test('the router and breadcrumb take their path from the backend content', () => {
    for (const name of ['DruxtRouter', 'DruxtBreadcrumb']) {
      const path = m.COMPONENTS[name].props.find((p) => p.name === 'path')
      assert.equal(path.source, 'paths')
      assert.equal(path.required, true)
    }
  })
})

describe('pickOption', () => {
  const list = [
    { value: 'a', label: 'Alpha (a)' },
    { value: 'b', label: 'Bravo (b)' },
  ]
  test('takes the value asked for, or the first', () => {
    assert.equal(m.pickOption(list, 'b'), 'b')
    assert.equal(m.pickOption(list, 'zzz'), 'a')
    assert.equal(m.pickOption(list), 'a')
    assert.equal(m.pickOption([], 'a'), undefined)
  })
  test('takes the option whose label matches a pattern', () => {
    assert.equal(m.pickOption(list, /Bravo/), 'b')
    assert.equal(m.pickOption(list, /nothing/), 'a')
  })
})

describe('demo defaults', () => {
  const step = (name, key) => name.chain.steps.find((s) => s.name === key)
  test('each backend prefers what demos best', () => {
    const block = m.COMPONENTS.DruxtBlock.props.find((p) => p.name === 'uuid')
    assert.equal(
      m.pickOption(
        [
          { value: '1', label: 'umami_branding' },
          { value: '2', label: 'umami_banner_recipes' },
        ],
        block.prefer({ backend: 'umami' })
      ),
      '2'
    )
    assert.equal(
      m.pickOption(
        [
          { value: '1', label: 'druxtjs_branding' },
          { value: '2', label: 'druxtjs_docs_menu' },
        ],
        block.prefer({ backend: 'site' })
      ),
      '1'
    )
    assert.equal(step(m.COMPONENTS.DruxtBlockRegion, 'name').prefer, 'content')
    assert.equal(step(m.COMPONENTS.DruxtEntity, 'bundle').prefer({ backend: 'umami' }), 'recipe')
    assert.equal(
      m.pickOption(
        [
          { value: 'x', label: 'Borscht (x)' },
          { value: 'y', label: 'Deep mediterranean quiche (y)' },
        ],
        step(m.COMPONENTS.DruxtEntity, 'uuid').prefer({ backend: 'umami' })
      ),
      'y'
    )
    // The router shows a path resolving, so it prefers a short page over a long read.
    const path = m.COMPONENTS.DruxtRouter.props.find((p) => p.name === 'path')
    assert.equal(
      m.pickOption(
        [
          {
            value: '/tutorials/getting-started',
            label: 'Getting started (/tutorials/getting-started)',
          },
          {
            value: '/explanation/drupal-for-nuxt-developers',
            label: 'Drupal for Nuxt developers (/explanation/drupal-for-nuxt-developers)',
          },
        ],
        path.prefer({ backend: 'site' })
      ),
      '/explanation/drupal-for-nuxt-developers'
    )
    assert.equal(path.prefer({ backend: 'umami' }), '/about-umami')
  })
})

describe('pages', () => {
  test('a module page lists the package components that render on their own', () => {
    assert.deepEqual(m.liveComponentsOf('blocks'), ['DruxtBlock', 'DruxtBlockRegion'])
    assert.deepEqual(m.liveComponentsOf('druxt'), [])
  })

  test('a component of any tier belongs with its parent package', () => {
    assert.equal(m.packageOf('DruxtField'), 'entity')
    assert.equal(m.packageOf('DruxtBlockViewsBlock'), 'blocks')
    assert.equal(m.packageOf('DruxtViewsPager'), 'views')
    assert.equal(m.packageOf('Nope'), null)
  })

  test('an API page knows every tier, and nothing else', () => {
    assert.equal(m.knowsComponent('DruxtEntity'), true)
    assert.equal(m.knowsComponent('DruxtMenuItem'), true)
    assert.equal(m.knowsComponent('DruxtFieldImage'), true)
    assert.equal(m.knowsComponent('DruxtEntityMixin'), false)
  })
})

describe("a reader's own Drupal", () => {
  test('parseOrigin keeps an origin, adds https, and refuses what a https page cannot fetch', () => {
    assert.deepEqual(m.parseOrigin('https://example.com/some/path'), {
      origin: 'https://example.com',
    })
    assert.deepEqual(m.parseOrigin('example.com'), { origin: 'https://example.com' })
    assert.deepEqual(m.parseOrigin('http://example.com', 'http:'), { origin: 'http://example.com' })
    assert.match(m.parseOrigin('http://example.com').error, /https/)
    assert.match(m.parseOrigin('not a url at all ://').error, /not a URL/)
  })

  test('customBackend talks to the origin directly, with no proxy', () => {
    const b = m.customBackend('https://drupal.example')
    assert.equal(b.api, 'https://drupal.example/jsonapi')
    assert.equal(b.proxyRoot, 'https://drupal.example')
    assert.equal(b.baseUrl, 'https://drupal.example')
    assert.equal(b.label, 'drupal.example')
  })

  // A Drupal with JSON:API, blocks, menus and views, but neither Decoupled
  // Router nor JSON:API Views, and menu items answering.
  const drupal = (url) => {
    const ok = (body) => ({ ok: true, status: 200, json: async () => body })
    if (url === 'https://drupal.example/jsonapi')
      return ok({
        links: { 'node--article': {}, 'block--block': {}, 'menu--menu': {}, 'view--view': {} },
      })
    if (url.startsWith('https://drupal.example/router/translate-path')) return { status: 404 }
    if (url.startsWith('https://drupal.example/jsonapi/menu/menu'))
      return ok({ data: [{ attributes: { drupal_internal__id: 'footer' } }] })
    if (url === 'https://drupal.example/jsonapi/menu_items/footer') return ok({ data: [] })
    if (url.startsWith('https://drupal.example/jsonapi/view/view'))
      return ok({
        data: [{ attributes: { drupal_internal__id: 'content', display: { page_1: {} } } }],
      })
    if (url === 'https://drupal.example/jsonapi/views/content/page_1') return { status: 404 }
    throw new Error('unexpected ' + url)
  }

  test('probeBackend asks for what the index cannot say, and names what each missing module costs', async () => {
    const calls = []
    globalThis.fetch = async (url) => {
      calls.push(url)
      return drupal(url)
    }
    try {
      const { backend } = await m.probeBackend('https://drupal.example')
      assert.deepEqual(backend.nodeBundles, ['article'])
      assert.equal(backend.reasons.DruxtBlock, undefined)
      assert.equal(backend.reasons.DruxtMenu, undefined)
      assert.match(backend.reasons.DruxtRouter, /Decoupled Router/)
      assert.match(backend.reasons.DruxtSite, /Decoupled Router/)
      assert.match(backend.reasons.DruxtView, /JSON:API Views/)
      assert.ok(calls.includes('https://drupal.example/jsonapi/menu_items/footer'))
      assert.ok(calls.includes('https://drupal.example/jsonapi/views/content/page_1'))
    } finally {
      delete globalThis.fetch
    }
  })

  test('probeBackend tells a refusing Drupal from a missing module', async () => {
    globalThis.fetch = async (url) =>
      url === 'https://drupal.example/jsonapi/menu_items/footer' ? { status: 403 } : drupal(url)
    try {
      const { backend } = await m.probeBackend('https://drupal.example')
      assert.match(backend.reasons.DruxtMenu, /answers 403 for JSON:API Menu Items/)
      assert.match(backend.reasons.DruxtView, /needs JSON:API Views/)
    } finally {
      delete globalThis.fetch
    }
  })

  test('probeBackend tells CORS from a missing JSON:API', async () => {
    globalThis.fetch = async () => {
      throw new TypeError('Failed to fetch')
    }
    try {
      await assert.rejects(m.probeBackend('https://drupal.example'), /allow this origin/)
    } finally {
      delete globalThis.fetch
    }
    globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({}) })
    try {
      await assert.rejects(m.probeBackend('https://drupal.example'), /No JSON:API answered/)
    } finally {
      delete globalThis.fetch
    }
  })
})
