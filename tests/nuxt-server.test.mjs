// Unit tests for the frontend's production server: the page cache, its
// request handler and the Drupal readiness check.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { existsSync, mkdtempSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  SECURITY_HEADERS,
  createHandler,
  createPageCache,
  crawl,
  isPage,
} = require('../nuxt/server/page-cache.js')
const {
  backendOrigin,
  backendReady,
  deployedRevision,
  deploymentReady,
  resolveOrigin,
  serviceRoute,
  waitForBackend,
} = require('../nuxt/server/backend.js')
const { PAGE, createStartingHandler } = require('../nuxt/server/starting.js')

// Serve a request listener on a free port for the length of one callback.
const withServer = async (listener, callback) => {
  const server = http.createServer(listener)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`)
  } finally {
    if (server.closeAllConnections) server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
}

const request = (url, { method = 'GET', headers = {} } = {}) =>
  new Promise((resolve, reject) => {
    http
      .request(url, { method, headers }, (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const raw = Buffer.concat(chunks)
          resolve({ status: res.statusCode, headers: res.headers, body: raw.toString(), raw })
        })
      })
      .on('error', reject)
      .end()
  })

const until = async (condition) => {
  for (let i = 0; i < 100 && !condition(); i++)
    await new Promise((resolve) => setTimeout(resolve, 10))
  return condition()
}

const tempDir = () => mkdtempSync(path.join(tmpdir(), 'page-cache-'))

const live =
  (status = 200) =>
  (req, res) => {
    res.writeHead(status, { 'Content-Type': 'text/plain' })
    res.end('live')
  }

describe('isPage', () => {
  test('takes a GET or HEAD of a page path', () => {
    for (const pathname of ['/', '/tutorials/getting-started', '/api/druxt', '/modules']) {
      assert.equal(isPage('GET', pathname), true, pathname)
    }
    assert.equal(isPage('HEAD', '/how-to'), true)
  })

  test('leaves assets, APIs and other methods alone', () => {
    const others = ['/_nuxt/app.js', '/_content/x', '/_decoupled/logo', '/jsonapi/node/doc_page']
    for (const pathname of [
      ...others,
      '/router/translate-path',
      '/sites/default/files/a.png',
      '/oauth/userinfo',
      '/icon.png',
      '/sitemap.xml',
    ]) {
      assert.equal(isPage('GET', pathname), false, pathname)
    }
    assert.equal(isPage('POST', '/'), false)
  })
})

describe('createPageCache', () => {
  test('stores a rendered page and reads it back fresh', async () => {
    const dir = tempDir()
    try {
      const cache = createPageCache({ dir, ttl: 60000, render: async () => ({ html: '<p>a</p>' }) })
      assert.equal(await cache.store('/a/b'), '<p>a</p>')
      assert.ok(existsSync(path.join(dir, 'a', 'b', 'index.html')))
      const page = await cache.read('/a/b')
      assert.equal(page.body.toString(), '<p>a</p>')
      assert.equal(page.encoding, null)
      assert.equal(page.stale, false)
      assert.equal(await cache.read('/missing'), null)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('keeps brotli and gzip copies, and reads the one the client accepts', async () => {
    const dir = tempDir()
    try {
      const html = `<p>${'compressible '.repeat(200)}</p>`
      const cache = createPageCache({ dir, ttl: 60000, render: async () => ({ html }) })
      await cache.store('/c')
      const br = await cache.read('/c', 'gzip, deflate, br')
      assert.equal(br.encoding, 'br')
      assert.equal(brotliDecompressSync(br.body).toString(), html)
      assert.ok(br.body.length < html.length)
      const gz = await cache.read('/c', 'gzip')
      assert.equal(gz.encoding, 'gzip')
      const refused = await cache.read('/c', 'br;q=0, gzip')
      assert.equal(refused.encoding, 'gzip')
      assert.equal(gunzipSync(gz.body).toString(), html)
      assert.equal((await cache.read('/c', '')).encoding, null)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('marks a page older than the time to live as stale', async () => {
    const dir = tempDir()
    try {
      const cache = createPageCache({ dir, ttl: 60000, render: async () => ({ html: 'x' }) })
      await cache.store('/')
      const old = new Date(Date.now() - 120000)
      utimesSync(cache.fileFor('/'), old, old)
      assert.equal((await cache.read('/')).stale, true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('drops a page, and its compressed copies, when it now fails or redirects', async () => {
    const dir = tempDir()
    try {
      let result = { html: 'x' }
      const lines = []
      const cache = createPageCache({
        dir,
        ttl: 60000,
        render: async () => result,
        log: (line) => lines.push(line),
      })
      await cache.store('/gone')
      assert.ok(existsSync(`${cache.fileFor('/gone')}.br`))
      result = { html: 'error page', error: { statusCode: 404 } }
      assert.equal(await cache.store('/gone'), null)
      assert.equal(await cache.read('/gone', 'br, gzip'), null)
      assert.equal(existsSync(`${cache.fileFor('/gone')}.br`), false)
      assert.equal(existsSync(`${cache.fileFor('/gone')}.gz`), false)
      result = { html: '', redirected: { path: '/elsewhere' } }
      assert.equal(await cache.store('/moved'), null)
      assert.equal(existsSync(cache.fileFor('/moved')), false)
      assert.deepEqual(lines, [
        'cache: /gone not stored: 404',
        'cache: /moved not stored: redirect',
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('renders a path once while a render is in flight', async () => {
    const dir = tempDir()
    try {
      let renders = 0
      const cache = createPageCache({
        dir,
        ttl: 60000,
        render: async () => ({ html: `render ${++renders}` }),
      })
      const [first, second] = await Promise.all([cache.store('/a'), cache.store('/a')])
      assert.equal(renders, 1)
      assert.equal(first, second)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('logs a render that throws and stores nothing', async () => {
    const dir = tempDir()
    try {
      const lines = []
      const render = async () => {
        throw new Error('boom')
      }
      const cache = createPageCache({ dir, ttl: 60000, render, log: (line) => lines.push(line) })
      assert.equal(await cache.store('/a'), null)
      assert.deepEqual(lines, ['cache: /a did not render: boom'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('refuses a path outside its directory', async () => {
    const cache = createPageCache({ dir: tempDir(), ttl: 0, render: async () => ({ html: 'x' }) })
    assert.equal(cache.fileFor('/../../outside'), null)
    assert.equal(await cache.read('/../../outside'), null)
    assert.equal(await cache.store('/../../outside'), null)
  })
})

describe('createHandler', () => {
  test('renders assets and APIs live, with no cache header', async () => {
    const handler = createHandler({ cache: null, live: live() })
    await withServer(handler, async (base) => {
      const res = await request(`${base}/jsonapi/node/doc_page`)
      assert.equal(res.body, 'live')
      assert.equal(res.headers['x-docs-cache'], undefined)
    })
  })

  test('redirects a trailing slash away, keeping the query', async () => {
    await withServer(createHandler({ cache: null, live: live() }), async (base) => {
      const res = await request(`${base}/how-to/?a=1`)
      assert.equal(res.status, 301)
      assert.equal(res.headers.location, '/how-to?a=1')
      // An encoded "//host" stays a path, never a protocol-relative redirect.
      const encoded = encodeURIComponent('//example.com')
      const odd = await request(`${base}/${encoded}//`)
      assert.equal(odd.headers.location, `/${encoded}`)
    })
  })

  test('renders a signed-in editor live, never from the store and never into it', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'docs-cache-'))
    let renders = 0
    const cache = createPageCache({
      dir,
      ttl: 60000,
      render: async () => ({ html: `<p>live ${++renders}</p>` }),
    })
    await cache.store('/how-to')
    const stored = await cache.read('/how-to')
    const live = (req, res) => res.end('<p>rendered for the request</p>')
    try {
      await withServer(createHandler({ cache, live }), async (base) => {
        const editor = await request(`${base}/how-to`, {
          headers: {
            cookie: 'auth.strategy=drupal-password; auth._token.drupal-password=Bearer%20abc',
          },
        })
        assert.equal(editor.body, '<p>rendered for the request</p>')
        assert.equal(editor.headers['x-docs-cache'], 'BYPASS')
        assert.equal(editor.headers['cache-control'], 'no-store')
        // The store is untouched: the next anonymous reader gets the copy from before.
        const reader = await request(`${base}/how-to`)
        assert.equal(reader.headers['x-docs-cache'], 'HIT')
        assert.equal(reader.body, stored.body.toString())
        // A cookie that is not the token, or a signed-out one, is an anonymous reader.
        for (const cookie of [
          'auth.strategy=drupal-password',
          'auth._token.drupal-password=false',
        ]) {
          const other = await request(`${base}/how-to`, { headers: { cookie } })
          assert.equal(other.headers['x-docs-cache'], 'HIT', cookie)
        }
      })
      assert.equal(renders, 1)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('bypasses the store for live=1 only, not for any query string', async () => {
    const dir = tempDir()
    try {
      const cache = createPageCache({
        dir,
        ttl: 60000,
        render: async () => ({ html: '<p>stored</p>' }),
      })
      await cache.store('/page')
      await withServer(createHandler({ cache, live: live() }), async (base) => {
        const tagged = await request(`${base}/page?utm_source=test`)
        assert.equal(tagged.headers['x-docs-cache'], 'HIT')
        assert.equal(tagged.body, '<p>stored</p>')
        const fresh = await request(`${base}/page?live=1`)
        assert.equal(fresh.headers['x-docs-cache'], undefined)
        assert.equal(fresh.body, 'live')
        const both = await request(`${base}/page?a=1&live=1`)
        assert.equal(both.body, 'live')
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("hands Drupal's own paths to the live app and never stores them", async () => {
    const dir = tempDir()
    try {
      const cache = createPageCache({
        dir,
        ttl: 60000,
        render: async () => ({ html: '<p>stored</p>' }),
      })
      await cache.store('/user/login')
      await cache.store('/page')
      const passThrough = (pathname) => pathname.startsWith('/user')
      await withServer(createHandler({ cache, live: live(), passThrough }), async (base) => {
        const login = await request(`${base}/user/login`)
        assert.equal(login.body, 'live')
        assert.equal(login.headers['x-docs-cache'], undefined)
        const trailing = await request(`${base}/user/`)
        assert.equal(trailing.status, 200, 'not redirected to drop the slash')
        const page = await request(`${base}/page`)
        assert.equal(page.headers['x-docs-cache'], 'HIT')
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('renders a missing page live, then serves it stored', async () => {
    const dir = tempDir()
    try {
      const cache = createPageCache({
        dir,
        ttl: 60000,
        render: async () => ({ html: '<p>stored</p>' }),
      })
      await withServer(createHandler({ cache, live: live() }), async (base) => {
        const miss = await request(`${base}/page`)
        assert.equal(miss.headers['x-docs-cache'], 'MISS')
        assert.equal(miss.body, 'live')
        assert.ok(await until(() => existsSync(cache.fileFor('/page'))))

        const hit = await request(`${base}/page`)
        assert.equal(hit.status, 200)
        assert.equal(hit.headers['x-docs-cache'], 'HIT')
        assert.equal(hit.headers['content-type'], 'text/html; charset=utf-8')
        assert.equal(hit.headers['cache-control'], 'no-cache')
        assert.equal(hit.body, '<p>stored</p>')

        const since = new Date(Date.now() + 60000).toUTCString()
        const unchanged = await request(`${base}/page`, { headers: { 'If-Modified-Since': since } })
        assert.equal(unchanged.status, 304)
        const head = await request(`${base}/page`, { method: 'HEAD' })
        assert.equal(head.body, '')
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('serves a stored page compressed when the client accepts it', async () => {
    const dir = tempDir()
    try {
      const html = `<p>${'stored '.repeat(300)}</p>`
      const cache = createPageCache({ dir, ttl: 60000, render: async () => ({ html }) })
      await cache.store('/page')
      await withServer(createHandler({ cache, live: live() }), async (base) => {
        const br = await request(`${base}/page`, { headers: { 'Accept-Encoding': 'gzip, br' } })
        assert.equal(br.headers['content-encoding'], 'br')
        assert.equal(br.headers.vary, 'Accept-Encoding')
        assert.equal(Number(br.headers['content-length']), br.raw.length)
        assert.equal(brotliDecompressSync(br.raw).toString(), html)
        const gz = await request(`${base}/page`, { headers: { 'Accept-Encoding': 'gzip' } })
        assert.equal(gz.headers['content-encoding'], 'gzip')
        assert.equal(gunzipSync(gz.raw).toString(), html)
        const plain = await request(`${base}/page`)
        assert.equal(plain.headers['content-encoding'], undefined)
        assert.equal(plain.body, html)
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('sends the security headers on every response, and HSTS only over https', async () => {
    await withServer(createHandler({ cache: null, live: live() }), async (base) => {
      for (const target of [`${base}/`, `${base}/jsonapi/x`]) {
        const res = await request(target)
        for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
          assert.equal(res.headers[name.toLowerCase()], value, `${name} on ${target}`)
        }
        assert.equal(res.headers['strict-transport-security'], undefined)
      }
      const tls = await request(`${base}/`, { headers: { 'X-Forwarded-Proto': 'https,http' } })
      assert.equal(tls.headers['strict-transport-security'], 'max-age=31536000')
    })
  })

  test('never stores a page that did not answer 200', async () => {
    const dir = tempDir()
    try {
      let renders = 0
      const cache = createPageCache({
        dir,
        ttl: 60000,
        render: async () => ({ html: `${++renders}` }),
      })
      await withServer(createHandler({ cache, live: live(404) }), async (base) => {
        assert.equal((await request(`${base}/nowhere`)).status, 404)
        await new Promise((resolve) => setTimeout(resolve, 50))
        assert.equal(renders, 0)
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('serves a stale page and renders a fresh copy behind it', async () => {
    const dir = tempDir()
    try {
      let renders = 0
      const cache = createPageCache({
        dir,
        ttl: 0,
        render: async () => ({ html: `render ${++renders}` }),
      })
      await cache.store('/page')
      await withServer(createHandler({ cache, live: live() }), async (base) => {
        const res = await request(`${base}/page`)
        assert.equal(res.headers['x-docs-cache'], 'STALE')
        assert.equal(res.body, 'render 1')
        assert.ok(await until(() => renders === 2))
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('sends an old path on, before the store or a render is consulted', async () => {
    await withServer(createHandler({ cache: null, live: live() }), async (base) => {
      const res = await request(`${base}/guide/proxy/?utm_source=old`)
      assert.equal(res.status, 301)
      assert.equal(res.headers.location, '/how-to/proxy?utm_source=old')
      assert.equal(
        (await request(`${base}/api/components/DruxtEntity.html`)).headers.location,
        '/api/packages/entity/components/DruxtEntity'
      )
    })
  })

  test('asks search engines to stay away only when told to', async () => {
    await withServer(createHandler({ cache: null, live: live(), noindex: true }), async (base) => {
      assert.equal((await request(`${base}/`)).headers['x-robots-tag'], 'noindex, nofollow')
    })
    await withServer(createHandler({ cache: null, live: live() }), async (base) => {
      assert.equal((await request(`${base}/`)).headers['x-robots-tag'], undefined)
    })
  })

  test('sets noindex on the autogenerated amazee host even in production', async () => {
    await withServer(createHandler({ cache: null, live: live(), noindex: false }), async (base) => {
      const host = { Host: 'nuxt.main.druxtjs-org.au2.amazee.io' }
      assert.equal(
        (await request(`${base}/`, { headers: host })).headers['x-robots-tag'],
        'noindex, nofollow'
      )
      // The same host with a trailing dot, or in capitals, is the same host.
      assert.equal(
        (await request(`${base}/`, { headers: { Host: 'Nuxt.Main.druxtjs-org.au2.AMAZEE.IO.' } }))
          .headers['x-robots-tag'],
        'noindex, nofollow'
      )
      assert.equal(
        (
          await request(`${base}/how-to`, {
            headers: { Host: 'nuxt.main.druxtjs-org.au2.amazee.io:443' },
          })
        ).headers['x-robots-tag'],
        'noindex, nofollow'
      )
      assert.equal(
        (await request(`${base}/`, { headers: { Host: 'druxtjs.org' } })).headers['x-robots-tag'],
        undefined
      )
    })
  })
})

describe('crawl', () => {
  const site = {
    '/': '<a href="/a">A</a> <a href="/b/">B</a> <link href="/_nuxt/app.css"> <a href="/jsonapi/x">API</a>',
    '/a': '<a href="/">Home</a> <a href="/c#part">C</a> <a href="/c?x=1">C</a>',
    '/b': '<p>b</p>',
    '/c': '<p>c</p>',
  }

  test('stores every page it can reach, once each', async () => {
    const visits = []
    const store = async (pathname) => {
      visits.push(pathname)
      return site[pathname] || null
    }
    const result = await crawl({ seeds: ['/', '/missing'], store })
    assert.deepEqual([...visits].sort(), ['/', '/a', '/b', '/c', '/missing'])
    assert.deepEqual(result, { stored: 4, visited: 5 })
  })

  test('stops at the limit', async () => {
    const result = await crawl({
      seeds: ['/'],
      store: async (pathname) => site[pathname],
      limit: 2,
    })
    assert.equal(result.visited, 2)
  })
})

describe('backend', () => {
  test('finds the route a service answers on', () => {
    const routes =
      'https://nginx.main.site.example.com, https://nuxt.main.site.example.com,not a url'
    assert.equal(serviceRoute(routes, 'nuxt'), 'https://nuxt.main.site.example.com')
    assert.equal(serviceRoute(routes, 'php'), undefined)
    assert.equal(serviceRoute(undefined, 'nuxt'), undefined)
  })

  test('prefers the custom route over the autogenerated amazee one', () => {
    const routes = [
      'https://nuxt.main.druxtjs-org.au2.amazee.io',
      'https://druxtjs.org',
      'https://www.druxtjs.org',
    ].join(',')
    assert.equal(serviceRoute(routes, 'nuxt'), 'https://druxtjs.org')
  })

  test('falls back to the autogenerated route when it is the only one', () => {
    assert.equal(
      serviceRoute('https://nuxt.main.druxtjs-org.au2.amazee.io', 'nuxt'),
      'https://nuxt.main.druxtjs-org.au2.amazee.io'
    )
  })

  test('prefers the custom storybook route', () => {
    const routes = 'https://storybook.main.druxtjs-org.au2.amazee.io,https://storybook.druxtjs.org'
    assert.equal(serviceRoute(routes, 'storybook'), 'https://storybook.druxtjs.org')
  })

  test('keeps the apex for the frontend when a sibling service has its own custom route', () => {
    const routes =
      'https://druxtjs.org,https://storybook.druxtjs.org,https://storybook.main.druxtjs-org.au2.amazee.io'
    assert.equal(serviceRoute(routes, 'nuxt'), 'https://druxtjs.org')
    assert.equal(serviceRoute(routes, 'storybook'), 'https://storybook.druxtjs.org')
  })

  test('leaves local routes to the callers that know them', () => {
    const routes = 'http://localhost:3000,http://localhost:8080,http://localhost:3030'
    assert.equal(serviceRoute(routes, 'nuxt'), undefined)
    assert.equal(serviceRoute(routes, 'storybook'), undefined)
  })

  test('resolveOrigin keeps an explicit SITE_ORIGIN, without its trailing slash', () => {
    assert.equal(
      resolveOrigin({
        SITE_ORIGIN: 'https://example.com/',
        LAGOON_ROUTES: 'https://nuxt.main.druxtjs-org.au2.amazee.io',
      }),
      'https://example.com'
    )
  })

  test('resolveOrigin keeps an explicit origin in production, even an amazee one', () => {
    assert.equal(
      resolveOrigin({
        LAGOON_ENVIRONMENT_TYPE: 'production',
        SITE_ORIGIN: 'https://preview.amazee.io/',
        LAGOON_ROUTES: 'https://nuxt.main.druxtjs-org.au2.amazee.io',
      }),
      'https://preview.amazee.io'
    )
  })

  test('resolveOrigin names the public domain in production, whatever the routes say', () => {
    assert.equal(
      resolveOrigin({
        LAGOON_ENVIRONMENT_TYPE: 'production',
        LAGOON_ROUTES: 'https://nuxt.main.druxtjs-org.au2.amazee.io,https://druxtjs.org',
      }),
      'https://druxtjs.org'
    )
    assert.equal(
      resolveOrigin({
        LAGOON_ENVIRONMENT_TYPE: 'production',
        LAGOON_ROUTES: 'https://nuxt.main.druxtjs-org.au2.amazee.io',
      }),
      'https://druxtjs.org'
    )
  })

  test('resolveOrigin uses the autogenerated route on previews', () => {
    assert.equal(
      resolveOrigin({
        LAGOON_ENVIRONMENT_TYPE: 'development',
        LAGOON_ROUTES: 'https://nuxt.main.druxtjs-org.au2.amazee.io',
      }),
      'https://nuxt.main.druxtjs-org.au2.amazee.io'
    )
  })

  test('resolveOrigin leaves an environment without routes alone', () => {
    assert.equal(resolveOrigin({}), undefined)
  })

  test('backendOrigin keeps an explicit public URL, without its trailing slash', () => {
    assert.equal(
      backendOrigin({
        DRUXT_PUBLIC_URL: 'https://cms.example.com/',
        LAGOON_ROUTES: 'https://cms.druxtjs.org',
      }),
      'https://cms.example.com'
    )
  })

  test('backendOrigin names the cms route in production, never the internal service', () => {
    const routes =
      'https://druxtjs.org,https://nginx.main.druxtjs-org.au2.amazee.io,https://cms.druxtjs.org'
    assert.equal(
      backendOrigin({ LAGOON_ROUTES: routes, DRUXT_BASE_URL: 'http://nginx:8080' }),
      'https://cms.druxtjs.org'
    )
  })

  test('backendOrigin uses the nginx route on a preview', () => {
    const routes =
      'https://nuxt.feature.druxtjs-org.au2.amazee.io,https://nginx.feature.druxtjs-org.au2.amazee.io'
    assert.equal(
      backendOrigin({ LAGOON_ROUTES: routes, DRUXT_BASE_URL: 'http://nginx:8080' }),
      'https://nginx.feature.druxtjs-org.au2.amazee.io'
    )
  })

  test('backendOrigin shares the base URL locally, and has a default', () => {
    assert.equal(
      backendOrigin({ DRUXT_BASE_URL: 'http://127.0.0.1:8888' }),
      'http://127.0.0.1:8888'
    )
    assert.equal(backendOrigin({}), 'http://127.0.0.1:8899')
  })

  test('is ready once the footer menu has items', async () => {
    let answer
    const drupal = (req, res) => {
      const [status, body] = req.url === '/jsonapi/menu_items/footer' ? answer : [404, '{}']
      res.writeHead(status, { 'Content-Type': 'application/vnd.api+json' })
      res.end(body)
    }
    await withServer(drupal, async (base) => {
      for (const [status, body, expected] of [
        [200, '{"data":[{"id":"a"}]}', true],
        [200, '{"data":[]}', false],
        [200, '<html>', false],
        [404, '{"data":[{"id":"a"}]}', false],
      ]) {
        answer = [status, body]
        assert.equal(await backendReady(base), expected, `${status} ${body}`)
      }
    })
    const closed = await withServer(live(), async (base) => base)
    assert.equal(await backendReady(closed), false)
  })

  test('reads the revision Drupal reports having deployed', async () => {
    let answer
    const drupal = (req, res) => {
      const [status, body] = req.url === '/druxt-docs/deployment' ? answer : [404, '{}']
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(body)
    }
    await withServer(drupal, async (base) => {
      for (const [status, body, expected] of [
        [200, '{"revision":"abc123"}', 'abc123'],
        [200, '{"revision":null}', null],
        [200, '{"revision":""}', null],
        [404, '{}', undefined],
        [200, 'not json', undefined],
        [200, '{"other":"field"}', undefined],
      ]) {
        answer = [status, body]
        assert.equal(await deployedRevision(base), expected, `${status} ${body}`)
      }
    })
  })

  test('is ready once Drupal reports the revision this build is from', async () => {
    let deployment
    let footer = [200, '{"data":[{"id":"a"}]}']
    const drupal = (req, res) => {
      const [status, body] =
        req.url === '/druxt-docs/deployment'
          ? deployment
          : req.url === '/jsonapi/menu_items/footer'
            ? footer
            : [404, '{}']
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(body)
    }
    await withServer(drupal, async (base) => {
      // The matching revision is the only thing that makes it ready.
      deployment = [200, '{"revision":"abc123"}']
      assert.equal(await deploymentReady(base, { revision: 'abc123' }), true, 'matching revision')

      // An older revision keeps it waiting, even though the footer menu
      // has items, which is exactly the case the old probe passed.
      deployment = [200, '{"revision":"older"}']
      assert.equal(await deploymentReady(base, { revision: 'abc123' }), false, 'older revision')

      // A rollout that has not recorded one yet is not ready either.
      deployment = [200, '{"revision":null}']
      assert.equal(
        await deploymentReady(base, { revision: 'abc123' }),
        false,
        'no revision recorded'
      )

      // No endpoint means a backend deployed before this existed, so the
      // footer-menu probe decides, in both directions.
      deployment = [404, '{}']
      assert.equal(
        await deploymentReady(base, { revision: 'abc123' }),
        true,
        'no endpoint, menu has items'
      )
      footer = [200, '{"data":[]}']
      assert.equal(
        await deploymentReady(base, { revision: 'abc123' }),
        false,
        'no endpoint, menu empty'
      )

      // Without a revision of its own there is nothing to compare, so the
      // gate does not apply and the fallback decides.
      footer = [200, '{"data":[{"id":"a"}]}']
      deployment = [200, '{"revision":"anything"}']
      assert.equal(await deploymentReady(base, {}), true, 'no local revision')
    })
  })

  test('gives up waiting rather than holding the port forever', async () => {
    const lines = []
    const ready = await waitForBackend('http://drupal', {
      interval: 1,
      timeout: 5,
      ready: async () => false,
      log: (line) => lines.push(line),
    })
    assert.equal(ready, false)
    // The first line is the ordinary "still waiting" one; what matters is
    // that the run ends by saying plainly that it stopped waiting.
    const last = lines[lines.length - 1]
    assert.match(last, /giving up waiting for Drupal/)
    assert.match(last, /may be against a backend that has not finished deploying/)
  })

  test('reports that it waited successfully when Drupal becomes ready', async () => {
    let checks = 0
    const ready = await waitForBackend('http://drupal', {
      interval: 1,
      ready: async () => ++checks === 2,
    })
    assert.equal(ready, true)
  })

  test('waits until Drupal is ready', async () => {
    let checks = 0
    const lines = []
    await waitForBackend('http://drupal', {
      interval: 1,
      ready: async () => ++checks === 3,
      log: (line) => lines.push(line),
    })
    assert.equal(checks, 3)
    assert.equal(lines.length, 1)
    assert.match(lines[0], /^waiting for Drupal at http:\/\/drupal/)
  })
})

describe('proxy', () => {
  test('hands a request to the other server and streams its answer back', async () => {
    const { createProxyHandler } = await import('../nuxt/server/proxy.js')
    const target = http.createServer((req, res) => {
      res.writeHead(201, {
        'Content-Type': 'text/plain',
        'X-Seen': req.url,
        'X-Host': req.headers.host,
      })
      res.end(`hello from ${req.method}`)
    })
    await new Promise((resolve) => target.listen(0, '127.0.0.1', resolve))
    try {
      const url = `http://127.0.0.1:${target.address().port}`
      await withServer(createProxyHandler(url), async (base) => {
        const res = await request(`${base}/iframe.html?id=x`)
        assert.equal(res.status, 201)
        assert.equal(res.headers['x-seen'], '/iframe.html?id=x')
        assert.equal(res.headers['x-host'], new URL(url).host)
        assert.equal(res.body, 'hello from GET')
      })
      // Drupal writes links to the host it is asked for, so the browser's stays on.
      await withServer(createProxyHandler(url, { keepHost: true }), async (base) => {
        const res = await request(`${base}/jsonapi`, { headers: { host: 'storybook.example' } })
        assert.equal(res.headers['x-host'], 'storybook.example')
      })
    } finally {
      target.close()
    }
  })

  test('answers 502 while the other server is not there', async () => {
    const { createProxyHandler } = await import('../nuxt/server/proxy.js')
    await withServer(createProxyHandler('http://127.0.0.1:1'), async (base) => {
      assert.equal((await request(`${base}/`)).status, 502)
    })
  })

  test("knows which paths are Drupal's", async () => {
    const { isBackendPath } = await import('../nuxt/server/proxy.js')
    for (const p of [
      '/jsonapi',
      '/jsonapi/node/article?x=1',
      '/router/translate-path?path=/',
      '/sites/default/files/a.png',
      '/_decoupled/logo',
    ]) {
      assert.equal(isBackendPath(p), true, p)
    }
    for (const p of ['/', '/iframe.html', '/sb-manager/x.js', '/jsonapi-like'])
      assert.equal(isBackendPath(p), false, p)
  })
})

describe('starting page', () => {
  const newState = () => ({ phase: 'waiting', since: '2026-09-12T00:00:00.000Z' })

  test('answers every path with the page, and asks for a retry', async () => {
    await withServer(createStartingHandler(newState()), async (base) => {
      for (const target of ['/', '/tutorials/getting-started', '/_nuxt/app.js']) {
        const res = await request(`${base}${target}`)
        assert.equal(res.status, 503, target)
        assert.equal(res.headers['content-type'], 'text/html; charset=utf-8')
        assert.equal(res.headers['retry-after'], '15')
        assert.equal(res.headers['cache-control'], 'no-store')
        assert.equal(res.headers['x-robots-tag'], 'noindex')
        assert.ok(res.body.includes('Waiting for the content'), target)
      }
      assert.equal((await request(`${base}/`, { method: 'HEAD' })).body, '')
    })
  })

  test('reports the phase, and the step the page draws', async () => {
    const state = newState()
    await withServer(createStartingHandler(state), async (base) => {
      const read = async () => {
        const res = await request(`${base}/__status`)
        assert.equal(res.status, 200)
        assert.equal(res.headers['content-type'], 'application/json; charset=utf-8')
        assert.equal(res.headers['cache-control'], 'no-store')
        return JSON.parse(res.body)
      }
      assert.deepEqual(await read(), {
        phase: 'waiting',
        step: 1,
        steps: 3,
        since: '2026-09-12T00:00:00.000Z',
      })
      state.phase = 'building'
      assert.equal((await read()).step, 2)
      state.phase = 'starting'
      assert.equal((await read()).step, 3)
      // A failure is none of the three steps, so the bar reports no step.
      state.phase = 'failed'
      assert.equal((await read()).step, 0)
      assert.equal((await read()).phase, 'failed')
    })
  })

  test('reads the status path with a query string too', async () => {
    await withServer(createStartingHandler(newState()), async (base) => {
      const res = await request(`${base}/__status?t=1`)
      assert.equal(JSON.parse(res.body).phase, 'waiting')
    })
  })

  test('carries the words for every phase, and asks for nothing over the network', () => {
    const html = PAGE.toString()
    for (const words of [
      'Waiting for the content',
      'Building the site',
      'Almost there',
      'Something went wrong',
      'This is taking longer than usual',
    ]) {
      assert.ok(html.includes(words), words)
    }
    assert.equal(/<(?:script|link|img)[^>]+(?:src|href)=/.test(html), false)
  })
})
