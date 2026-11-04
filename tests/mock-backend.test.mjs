// The playground's Umami mock: the backend entry, the option lists and the
// runtime's adapter answered in the browser, and the build step that writes
// the dump. The engine and the preset are nuxt/'s installed copies.
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
const dumpFile = path.join(out, '_mock/umami/dump.json')

// The browser fetches the dump from this site; every other URL is the network.
const network = []
const realFetch = globalThis.fetch
before(() => {
  globalThis.fetch = async (url, init) => {
    if (url === `${mock.MOCK_ROOT}/dump.json`)
      return new Response(fs.readFileSync(dumpFile, 'utf8'), { status: 200 })
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
    assert.equal(b.mock, true)
    assert.equal(b.umami, true)
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
  test('writes the dump and every file it names', () => {
    assert.match(firstRun, /written to/)
    const dump = JSON.parse(fs.readFileSync(dumpFile, 'utf8'))
    const files = new Set(fs.readdirSync(path.join(out, '_mock/umami/sites/default/files')))
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
    assert.ok(urls.size > 0)
    for (const url of urls)
      assert.ok(files.has(url.replace('/sites/default/files/', '')), `${url} has no file`)
  })

  test('skips a second run for the same preset version', () => {
    assert.match(write(), /already in/)
  })
})
