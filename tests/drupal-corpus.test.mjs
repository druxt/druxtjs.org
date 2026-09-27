// The authored documentation read from Drupal, and merged with the
// generated reference pages, for sitemap.xml and the llms files.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  collectionUrl,
  fetchDrupalDocs,
  mergeCorpus,
  paragraphMarkdown,
} = require('../nuxt/lib/drupal-corpus.js')
const { createArtefacts } = require('../nuxt/server/artefacts.js')
const { createHandler } = require('../nuxt/server/page-cache.js')

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

const get = (url) =>
  new Promise((resolve) => {
    http.get(url, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    })
  })

const page = (alias, { title = 'A page', weight = 0, content = [] } = {}) => ({
  type: 'node--doc_page',
  id: alias,
  attributes: {
    title,
    path: { alias },
    field_description: `About ${alias}`,
    field_weight: weight,
  },
  relationships: { field_content: { data: content } },
})

describe('collectionUrl', () => {
  test('asks only for published pages, with their body', () => {
    const url = new URL(collectionUrl('http://drupal'))
    assert.equal(url.pathname, '/jsonapi/node/doc_page')
    assert.equal(url.searchParams.get('filter[status]'), '1')
    assert.match(url.searchParams.get('include'), /field_content/)
    assert.match(url.searchParams.get('fields[node--doc_page]'), /path/)
  })
})

describe('paragraphMarkdown', () => {
  test('carries authored text through as it was written', () => {
    const markdown = paragraphMarkdown({
      type: 'paragraph--docs_text',
      attributes: { field_text: { value: '## Heading\n\nBody.', format: 'docs_markdown' } },
    })
    assert.equal(markdown, '## Heading\n\nBody.')
  })

  test('fences code with its language', () => {
    const markdown = paragraphMarkdown({
      type: 'paragraph--docs_code',
      attributes: { field_code: 'npm i druxt-site', field_language: 'sh' },
    })
    assert.equal(markdown, '```sh\nnpm i druxt-site\n```')
  })

  test('keeps a callout as the blockquote it was authored as', () => {
    const markdown = paragraphMarkdown({
      type: 'paragraph--docs_callout',
      attributes: { field_callout: { value: '> **Before you start:** read this.' } },
    })
    assert.equal(markdown, '> **Before you start:** read this.')
  })

  test('takes an image down to its alt text, which is the part that reads', () => {
    const byId = new Map([
      [
        'media--image:m1',
        { relationships: { field_media_image: { data: { meta: { alt: 'A screenshot' } } } } },
      ],
    ])
    const markdown = paragraphMarkdown(
      {
        type: 'paragraph--docs_image',
        relationships: { field_media: { data: { type: 'media--image', id: 'm1' } } },
      },
      byId
    )
    assert.equal(markdown, '![A screenshot]()')
  })

  test('drops a layout section, which is presentation rather than content', () => {
    assert.equal(paragraphMarkdown({ type: 'paragraph--docs_layout_section', attributes: {} }), '')
  })
})

describe('fetchDrupalDocs', () => {
  test('reads a page into the shape the indexes take', async () => {
    const answer = {
      data: [
        page('/how-to/proxy', {
          title: 'Proxy',
          weight: 3,
          content: [{ type: 'paragraph--docs_text', id: 'p1' }],
        }),
      ],
      included: [
        { type: 'paragraph--docs_text', id: 'p1', attributes: { field_text: { value: 'Body.' } } },
      ],
    }
    const docs = await fetchDrupalDocs('http://drupal', { fetch: async () => answer })
    assert.deepEqual(docs, [
      {
        route: '/how-to/proxy',
        title: 'Proxy',
        description: 'About /how-to/proxy',
        weight: 3,
        section: 'how-to',
        content: 'Body.',
      },
    ])
  })

  test('follows pagination to the end', async () => {
    const pages = [
      { data: [page('/a')], links: { next: { href: 'http://drupal/next' } } },
      { data: [page('/b')] },
    ]
    let call = 0
    const docs = await fetchDrupalDocs('http://drupal', { fetch: async () => pages[call++] })
    assert.deepEqual(
      docs.map((doc) => doc.route),
      ['/a', '/b']
    )
  })

  // Returning a partial corpus would be cached as a good answer, and an
  // index that has silently lost the authored pages reads to a crawler as
  // those pages having been removed. Failing keeps the previous answer.
  test('fails rather than reporting a corpus it could not read', async () => {
    const lines = []
    await assert.rejects(
      () =>
        fetchDrupalDocs('http://drupal', {
          fetch: async () => null,
          log: (line) => lines.push(line),
        }),
      /did not answer with a page of documents/
    )
    assert.match(lines[0], /no usable answer/)
  })

  test('fails when a later page of results is unreadable, rather than truncating', async () => {
    const answers = [{ data: [page('/a')], links: { next: { href: 'http://drupal/next' } } }, null]
    let call = 0
    await assert.rejects(
      () => fetchDrupalDocs('http://drupal', { fetch: async () => answers[call++], log: () => {} }),
      /did not answer with a page of documents/
    )
  })

  // The same truncation as an unreadable page, reached by a different door:
  // running out of requests while Drupal still has pages to give.
  test('fails rather than stopping halfway when there are more pages than it will read', async () => {
    const lines = []
    let served = 0
    await assert.rejects(
      () =>
        fetchDrupalDocs('http://drupal', {
          log: (line) => lines.push(line),
          // Always another page, so the request limit is what ends it.
          fetch: async () => ({
            data: [page(`/how-to/page-${served++}`)],
            links: { next: { href: 'http://drupal/next' } },
          }),
        }),
      /more pages than/
    )
    assert.match(lines[0], /still paginating/)
  })

  test('skips a page with no usable alias', async () => {
    const broken = { type: 'node--doc_page', id: 'x', attributes: { title: 'No alias', path: {} } }
    const docs = await fetchDrupalDocs('http://drupal', { fetch: async () => ({ data: [broken] }) })
    assert.deepEqual(docs, [])
  })
})

describe('mergeCorpus', () => {
  test('gives a route that exists in both to Drupal', () => {
    const merged = mergeCorpus(
      [{ route: '/modules/druxt', title: 'From Drupal' }],
      [{ route: '/modules/druxt', title: 'From the file' }]
    )
    assert.equal(merged.length, 1)
    assert.equal(merged[0].title, 'From Drupal')
  })

  test('keeps a generated page Drupal has no node for', () => {
    const merged = mergeCorpus([{ route: '/how-to/proxy' }], [{ route: '/api/druxt' }])
    assert.deepEqual(
      merged.map((doc) => doc.route),
      ['/api/druxt', '/how-to/proxy']
    )
  })

  test('survives either side being empty', () => {
    assert.deepEqual(mergeCorpus([], []), [])
    assert.equal(mergeCorpus(null, [{ route: '/a' }]).length, 1)
    assert.equal(mergeCorpus([{ route: '/a' }], null).length, 1)
  })
})

describe('artefacts', () => {
  const corpusOf = (routes) =>
    routes.map((route) => ({
      route,
      title: route,
      description: route,
      weight: 0,
      section: route.split('/')[1] || null,
      content: 'Body.',
    }))

  const serve = (options) =>
    createArtefacts({
      baseUrl: 'http://drupal',
      contentDir: '/nowhere',
      origin: 'https://druxtjs.org',
      readGenerated: () => [],
      ...options,
    })

  test('serves the three indexes, and leaves every other asset alone', async () => {
    const artefacts = serve({ fetchDocs: async () => corpusOf(['/how-to/proxy']) })
    const handler = createHandler({
      cache: null,
      artefacts,
      live: (req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('static middleware')
      },
    })
    await withServer(handler, async (base) => {
      const sitemap = await get(`${base}/sitemap.xml`)
      assert.equal(sitemap.status, 200)
      assert.match(sitemap.headers['content-type'], /application\/xml/)
      assert.match(sitemap.body, /<loc>https:\/\/druxtjs\.org\/how-to\/proxy<\/loc>/)

      for (const path of ['/llms.txt', '/llms-full.txt']) {
        const answer = await get(base + path)
        assert.equal(answer.status, 200, path)
        assert.match(answer.headers['content-type'], /text\/plain/, path)
      }

      // The asset test would otherwise send every .txt and .xml to the
      // static middleware; only these three are intercepted.
      for (const path of ['/robots.txt', '/manifest.xml']) {
        const answer = await get(base + path)
        assert.equal(answer.body, 'static middleware', path)
      }
    })
  })

  test('holds a built index for its time to live, then rebuilds', async () => {
    let reads = 0
    const artefacts = serve({
      ttl: 40,
      fetchDocs: async () => {
        reads += 1
        return corpusOf([`/page-${reads}`])
      },
    })
    const handler = createHandler({ cache: null, artefacts, live: (req, res) => res.end() })
    await withServer(handler, async (base) => {
      const first = await get(`${base}/sitemap.xml`)
      assert.match(first.body, /page-1/)
      // A second index inside the window reuses the same corpus read.
      await get(`${base}/llms.txt`)
      assert.equal(reads, 1)

      await new Promise((resolve) => setTimeout(resolve, 60))
      const later = await get(`${base}/sitemap.xml`)
      assert.match(later.body, /page-2/)
      assert.equal(reads, 2)
    })
  })

  test('serves the previous answer rather than an error when a rebuild fails', async () => {
    let fail = false
    const artefacts = serve({
      ttl: 20,
      fetchDocs: async () => {
        if (fail) throw new Error('Drupal is down')
        return corpusOf(['/how-to/proxy'])
      },
    })
    const handler = createHandler({ cache: null, artefacts, live: (req, res) => res.end() })
    await withServer(handler, async (base) => {
      assert.match((await get(`${base}/sitemap.xml`)).body, /how-to\/proxy/)
      fail = true
      await new Promise((resolve) => setTimeout(resolve, 40))
      const stale = await get(`${base}/sitemap.xml`)
      assert.equal(stale.status, 200)
      assert.match(stale.body, /how-to\/proxy/)
    })
  })

  // The defect this guards: the fetcher used to swallow a Drupal failure and
  // answer with an empty list, which the cache then held as a good corpus.
  // The two are wired together here rather than with an injected stub, so a
  // regression in either one is caught.
  test('a Drupal failure leaves the previous index standing, rather than publishing one without it', async () => {
    let drupalUp = true
    const artefacts = createArtefacts({
      baseUrl: 'http://drupal',
      contentDir: '/nowhere',
      origin: 'https://druxtjs.org',
      ttl: 20,
      readGenerated: () => [
        {
          route: '/api/druxt',
          title: 'API',
          description: 'x',
          weight: 0,
          section: 'api',
          content: '',
        },
      ],
      // The real fetcher, given a reader that fails the way getJson does.
      fetchDocs: (url, options) =>
        fetchDrupalDocs(url, {
          ...options,
          log: () => {},
          fetch: async () => (drupalUp ? { data: [page('/how-to/proxy')] } : null),
        }),
    })
    const handler = createHandler({ cache: null, artefacts, live: (req, res) => res.end() })
    await withServer(handler, async (base) => {
      const first = await get(`${base}/sitemap.xml`)
      assert.match(first.body, /how-to\/proxy/, 'the authored page is there while Drupal answers')

      drupalUp = false
      await new Promise((resolve) => setTimeout(resolve, 40))
      const after = await get(`${base}/sitemap.xml`)
      assert.equal(after.status, 200)
      assert.match(
        after.body,
        /how-to\/proxy/,
        'the authored page survives Drupal being unreachable'
      )
    })
  })

  test('answers 503 when it has never built and cannot', async () => {
    const artefacts = serve({
      fetchDocs: async () => {
        throw new Error('Drupal is down')
      },
    })
    const handler = createHandler({ cache: null, artefacts, live: (req, res) => res.end() })
    await withServer(handler, async (base) => {
      const answer = await get(`${base}/sitemap.xml`)
      assert.equal(answer.status, 503)
      assert.equal(answer.headers['retry-after'], '60')
    })
  })
})
