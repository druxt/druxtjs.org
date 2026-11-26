// The playground's mocks: the backend entries, the option lists and the
// runtime's adapter answered in the browser, and the build step that writes
// the dumps. The engine and the presets are nuxt/'s installed copies.
//
//   node --test "tests/*.test.mjs"

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NUXT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../nuxt')
const SCRIPT = path.join(NUXT, 'scripts/mock-dump.mjs')

const m = await import('../nuxt/utils/live-examples.js')
const mock = await import('../nuxt/utils/mock-backend.js')

// The build step writes the dump once, here, for every test that needs it.
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'mock-dump-'))
const write = () => execFileSync(process.execPath, [SCRIPT, out], { cwd: NUXT, encoding: 'utf8' })
const firstRun = write()

// The browser fetches a dump from this site; every other URL is the network.
const network = []
const realFetch = globalThis.fetch
before(() => {
  globalThis.fetch = async (url, init) => {
    const dump = String(url).match(/^\/_mock\/([a-z]+)\/dump\.json$/)
    if (dump)
      return new Response(fs.readFileSync(path.join(out, '_mock', dump[1], 'dump.json'), 'utf8'), {
        status: 200,
      })
    network.push(String(url))
    return realFetch(url, init)
  }
})
after(() => {
  globalThis.fetch = realFetch
  fs.rmSync(out, { recursive: true, force: true })
})

describe('the mock backend', () => {
  test('answers for its own origin, with its files on this site', () => {
    const b = m.BACKENDS.mock
    assert.equal(b.api, `${mock.MOCK_ORIGIN}/jsonapi`)
    assert.equal(b.baseUrl, mock.MOCK_ORIGIN)
    assert.equal(b.filesRoot, '/_mock/umami')
    assert.equal(b.mock, 'umami')
    assert.equal(b.umami, true)
  })

  test('has a mock per Drupal CMS preset, each on its own origin and files', () => {
    for (const preset of ['dashi', 'haven', 'mercury']) {
      const b = m.BACKENDS[preset]
      assert.equal(b.mock, preset)
      assert.equal(b.api, `https://${preset}.mock.invalid/jsonapi`)
      assert.equal(b.filesRoot, `/_mock/${preset}`)
      assert.equal(b.umami, undefined)
      assert.equal(mock.mockPresetOf(`${b.api}/node/page`), preset)
    }
    assert.equal(mock.mockPresetOf('https://example.mock.invalid/jsonapi'), null)
    assert.equal(mock.isMockUrl('https://druxtjs.org/jsonapi'), false)
  })

  test("groups the select: live Drupal sites, then the mocks, with a reader's own among the live", () => {
    const groups = m.groupBackends({
      ...m.BACKENDS,
      custom: m.customBackend('https://drupal.example'),
    })
    assert.deepEqual(
      groups.map((g) => g.label),
      ['Live Drupal', 'Mocked in your browser']
    )
    assert.deepEqual(groups[0].backends, ['site', 'umami', 'custom'])
    assert.deepEqual(groups[1].backends, ['mock', 'dashi', 'haven', 'mercury'])
  })

  test('keeps the block components off the Drupal CMS mocks, with the reason', () => {
    for (const name of ['DruxtBlock', 'DruxtBlockRegion', 'DruxtSite']) {
      const only = m.COMPONENTS[name].backends
      for (const key of ['site', 'umami', 'mock'])
        assert.equal(only[key], true, `${name} on ${key}`)
      for (const key of ['dashi', 'haven', 'mercury'])
        assert.match(only[key], /Canvas/, `${name} on ${key}`)
    }
  })

  test('offers DruxtView on the Drupal CMS mocks whose views are of content', async () => {
    const only = m.COMPONENTS.DruxtView.backends
    assert.equal(only.dashi, true)
    assert.equal(only.haven, true)
    assert.equal(typeof only.mercury, 'string')
    // Every content view on them fits on its first page, so a pager has nothing to ask for.
    for (const key of ['dashi', 'haven']) {
      const views = await m.SOURCES.views(m.BACKENDS[key].api)
      assert.ok(views.length, key)
      for (const { value } of views) {
        const displays = await m.SOURCES.displays(m.BACKENDS[key].api, { viewId: value })
        for (const { value: display } of displays) {
          const response = await mock.mockFetch(`${m.BACKENDS[key].api}/views/${value}/${display}`)
          if (response.status !== 200) continue
          const body = await response.json()
          assert.equal((body.links || {}).next, undefined, `${key} ${value} ${display}`)
        }
      }
    }
  })

  test('each Drupal CMS mock prefers what it holds', async () => {
    const want = {
      dashi: {
        DruxtEntity: ['uuid', /Deep mediterranean quiche/],
        DruxtRouter: ['path', '/recipes/deep-mediterranean-quiche'],
        DruxtView: ['viewId', 'recipes'],
      },
      haven: {
        DruxtEntity: ['uuid', /Restoring the outer reef/],
        DruxtRouter: ['path', '/projects/2026-11/restoring-outer-reef'],
        DruxtView: ['viewId', 'projects'],
      },
      mercury: { DruxtBreadcrumb: ['path', '/card-components'] },
    }
    for (const [key, components] of Object.entries(want)) {
      const b = m.BACKENDS[key]
      assert.equal(m.backendPreference(b, 'DruxtMenu', 'name'), 'main')
      for (const [component, [name, expected]] of Object.entries(components)) {
        const prefer = m.backendPreference(b, component, name)
        if (name === 'path') {
          const paths = await m.SOURCES.paths(b.api, {}, b)
          assert.equal(m.pickOption(paths, prefer), expected, `${key} ${component}`)
        } else if (name === 'uuid') {
          const bundle = m.backendPreference(b, component, 'bundle')
          const entities = await m.SOURCES.entities(b.api, { entityType: 'node', bundle })
          const picked = entities.find((o) => o.value === m.pickOption(entities, prefer))
          assert.match(picked.label, expected, `${key} ${component}`)
        } else assert.equal(prefer, expected, `${key} ${component}`)
      }
    }
    assert.equal(m.backendPreference(m.BACKENDS.mercury, 'DruxtRouter', 'path'), undefined)
    // A backend without preferences of its own leaves the component's.
    assert.equal(m.backendPreference(m.BACKENDS.site, 'DruxtMenu', 'name'), undefined)
  })

  test('keeps DruxtRouter to content, off Canvas pages it would render blank', async () => {
    const router = m.COMPONENTS.DruxtRouter
    assert.equal(router.props.find((p) => p.name === 'path').source, 'contentPaths')
    assert.match(router.backends.mercury, /Canvas/)
    const paths = await m.SOURCES.contentPaths(m.BACKENDS.dashi.api, {}, m.BACKENDS.dashi)
    assert.ok(paths.some((o) => o.value === '/recipes/deep-mediterranean-quiche'))
    assert.ok(!paths.some((o) => o.group === 'Canvas page'), JSON.stringify(paths))
  })

  test("lists a Drupal CMS mock's Canvas pages among its paths, and every content type past the first 50 displays", async () => {
    // Mercury's content is Canvas pages only, so its list has no groups.
    const mercury = await m.SOURCES.paths(m.BACKENDS.mercury.api, {}, m.BACKENDS.mercury)
    assert.ok(
      mercury.some((o) => o.value === '/card-components'),
      JSON.stringify(mercury)
    )
    const dashi = await m.SOURCES.paths(m.BACKENDS.dashi.api, {}, m.BACKENDS.dashi)
    assert.ok(
      dashi.some((o) => o.value === '/about-dashi' && o.group === 'Canvas page'),
      JSON.stringify(dashi)
    )
    assert.ok(
      dashi.some((o) => o.value === '/recipes/deep-mediterranean-quiche' && o.group === 'recipe')
    )
    const types = await m.SOURCES.entityTypes(m.BACKENDS.dashi.api)
    assert.ok(
      types.some((o) => o.value === 'node'),
      JSON.stringify(types)
    )
    const bundles = await m.SOURCES.bundles(m.BACKENDS.dashi.api, { entityType: 'node' })
    assert.deepEqual(
      bundles.map((o) => o.value),
      ['article', 'page', 'recipe']
    )
  })

  test("takes Umami's defaults, as the live demo does", () => {
    const name = m.COMPONENTS.DruxtMenu.props.find((p) => p.name === 'name')
    assert.equal(name.prefer({ backend: 'mock' }), 'main')
    assert.equal(name.prefer({ backend: 'site' }), 'docs')
    const viewId = m.COMPONENTS.DruxtView.chain.steps.find((s) => s.name === 'viewId')
    assert.equal(viewId.prefer({ backend: 'mock' }), 'recipes')
  })

  test('keeps DruxtView off the mock, with the reason', () => {
    const reason = m.COMPONENTS.DruxtView.backends.mock
    assert.equal(typeof reason, 'string')
    assert.match(reason, /first page/)
  })

  test('fills an option list from the mock, never the network', async () => {
    const menus = await m.SOURCES.menus(m.BACKENDS.mock.api)
    assert.ok(
      menus.some((o) => o.value === 'main'),
      JSON.stringify(menus)
    )
    assert.deepEqual(network, [])
  })

  test("answers a runtime's axios through the adapter", async () => {
    const adapter = await mock.mockAdapter()
    const response = await adapter({
      url: '/jsonapi/node/recipe',
      method: 'get',
      params: { 'page[limit]': 2 },
    })
    assert.equal(response.status, 200)
    assert.equal(response.data.data.length, 2)
    assert.deepEqual(network, [])
  })

  test('retries a failed load rather than keep the failure', async () => {
    const working = globalThis.fetch
    // A fresh module, so the engine above does not answer from its cache.
    const fresh = await import(`../nuxt/utils/mock-backend.js?retry=${Date.now()}`)
    globalThis.fetch = async () => new Response('', { status: 503 })
    await assert.rejects(fresh.loadMock(), /503/)
    globalThis.fetch = working
    assert.ok(await fresh.loadMock())
  })
})

describe('scripts/mock-dump.mjs', () => {
  test("writes every preset's dump, and every file the dump names", () => {
    for (const preset of mock.MOCK_PRESETS) {
      assert.match(firstRun, new RegExp(`${preset} mock .* written to`))
      assertFiles(preset)
    }
  })

  const assertFiles = (preset) => {
    const dump = JSON.parse(fs.readFileSync(path.join(out, '_mock', preset, 'dump.json'), 'utf8'))
    const files = new Set(listFiles(path.join(out, '_mock', preset, 'sites/default/files')))
    const urls = new Set()
    const walk = (o) => {
      if (Array.isArray(o)) o.forEach(walk)
      else if (o && typeof o === 'object') {
        if (o.type === 'file--file' && o.attributes && o.attributes.uri)
          urls.add(o.attributes.uri.url)
        Object.values(o).forEach(walk)
      }
    }
    walk(dump.resources)
    assert.ok(urls.size > 0, preset)
    for (const url of urls)
      assert.ok(
        files.has(decodeURIComponent(url.replace('/sites/default/files/', ''))),
        `${preset}: ${url} has no file`
      )
  }

  // Every file under a directory, by its path from there: Drupal CMS keeps them by month.
  const listFiles = (dir) =>
    fs.readdirSync(dir, { recursive: true }).filter((f) => fs.statSync(path.join(dir, f)).isFile())

  test('skips a second run for the same preset versions', () => {
    const again = write()
    for (const preset of mock.MOCK_PRESETS)
      assert.match(again, new RegExp(`${preset} mock .* already in`))
  })
})
