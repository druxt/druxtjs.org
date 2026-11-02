// The server's contract is the protocol: an AI tool that gets a malformed answer
// drops the server without saying why, so each exchange goes over real HTTP.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const {
  SERVER_VERSION,
  createDocsMcp,
  createMcpDiscovery,
  isMcpRequest,
  searchDocs,
} = require('../nuxt/server/docs-mcp.js')

const docs = [
  {
    route: '/how-to/proxy',
    title: 'Proxy the backend',
    description: 'Through Nuxt.',
    section: 'how-to',
    content: 'See [CORS](/how-to/configure-cors).',
  },
  {
    route: '/how-to/configure-cors',
    title: 'Configure CORS',
    description: 'In Drupal.',
    section: 'how-to',
    content: 'A proxy avoids this.',
  },
  {
    route: '/api/packages/druxt/CHANGELOG',
    title: 'Changelog',
    section: 'api',
    content: 'proxy proxy proxy',
  },
]

let server
let url
// node:http, not fetch: the site's floor is Node 16, which has no global fetch.
const request = (method, body) =>
  new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let text = ''
      res.on('data', (chunk) => (text += chunk))
      res.on('end', () => resolve({ status: res.statusCode, text }))
    })
    req.on('error', reject)
    req.end(body)
  })
const post = async (body, raw = false) => {
  const { status, text } = await request('POST', raw ? body : JSON.stringify(body))
  return { status, body: text ? JSON.parse(text) : null }
}
const call = (name, args) =>
  post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })

// Started here, not in a hook: Node 16 doesn't run top-level hooks.
server = http.createServer(
  createDocsMcp({ corpus: async () => docs, origin: 'https://example.test' })
)
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
url = `http://127.0.0.1:${server.address().port}/mcp`
server.unref()

describe('the protocol', () => {
  test('initialize agrees a version it knows, and offers tools', async () => {
    const { body } = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26' },
    })
    assert.equal(body.result.protocolVersion, '2025-03-26')
    assert.deepEqual(body.result.capabilities, { tools: {} })
    assert.equal(body.result.serverInfo.name, createMcpDiscovery('https://example.test').name)
  })

  test('initialize answers an unknown version with its own latest', async () => {
    const { body } = await post({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '1999-01-01' },
    })
    assert.equal(body.result.protocolVersion, '2025-06-18')
  })

  test('a notification gets 202 and no body', async () => {
    const { status, body } = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    assert.equal(status, 202)
    assert.equal(body, null)
  })

  test('every tool is marked read-only', async () => {
    const { body } = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    assert.deepEqual(
      body.result.tools.map((t) => t.name),
      ['search_docs', 'list_docs', 'get_doc']
    )
    assert.ok(body.result.tools.every((t) => t.annotations.readOnlyHint))
    // Claude's connector directory flags a tool without a title. Protocol
    // versions before 2025-06-18 only know the annotation.
    assert.ok(body.result.tools.every((t) => t.title && t.annotations.title === t.title))
  })

  test('refuses GET, broken JSON, a batch, an unknown method and an oversized body', async () => {
    assert.equal((await request('GET')).status, 405)
    assert.equal((await post('{', true)).body.error.code, -32700)
    assert.equal((await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }])).status, 400)
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'nope' })).body.error.code, -32601)
    assert.equal((await post('x'.repeat(70000), true)).status, 413)
  })
})

describe('a client that goes away', () => {
  test('an aborted request leaves the server answering', async () => {
    await new Promise((resolve) => {
      const req = http.request(url, { method: 'POST', headers: { 'Content-Length': 1000 } })
      req.on('error', () => {})
      req.write('{', () => {
        req.destroy()
        setTimeout(resolve, 50)
      })
    })
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'ping' })).status, 200)
  })
})

describe('the page at the same path', () => {
  test('a browser reaches the page, and a client reaches the server', () => {
    assert.equal(isMcpRequest({ method: 'GET', headers: { accept: 'text/html' } }), false)
    assert.equal(isMcpRequest({ method: 'GET', headers: { accept: 'text/event-stream' } }), true)
    assert.equal(isMcpRequest({ method: 'POST', headers: {} }), true)
    assert.equal(isMcpRequest({ method: 'OPTIONS', headers: {} }), true)
  })
})

describe('the tools', () => {
  test('a question finds the guide, whatever words surround it', () => {
    const pages = [
      {
        route: '/api/packages/views/components/DruxtView',
        title: 'DruxtView',
        section: 'api',
        content: 'the the the to to do drupal backend how',
      },
      ...docs,
    ]
    assert.equal(searchDocs(pages, 'how do I proxy the Drupal backend')[0].route, '/how-to/proxy')
  })

  test('a word finds its other forms', () => {
    const pages = [
      {
        route: '/how-to/theming',
        title: 'Theme Druxt components',
        section: 'how-to',
        content: 'Wrappers.',
      },
    ]
    assert.equal(searchDocs(pages, 'theming')[0].route, '/how-to/theming')
    assert.equal(
      searchDocs(
        [{ route: '/c', title: 'Cache responses', section: 'how-to', content: 'x' }],
        'caching'
      ).length,
      1
    )
  })

  test('only the first words of a long query are searched', () => {
    const query = `${Array.from({ length: 5000 }, (_, i) => `word${i}`).join(' ')} proxy`
    assert.deepEqual(searchDocs(docs, query), [])
  })

  test('a word is not matched inside another word', () => {
    assert.deepEqual(
      searchDocs([{ route: '/a', title: 'Toast', section: 'how-to', content: 'bread' }], 'to the'),
      []
    )
  })

  test('search ranks a title match first and leaves changelogs out', () => {
    assert.deepEqual(
      searchDocs(docs, 'proxy').map((d) => d.route),
      ['/how-to/proxy', '/how-to/configure-cors']
    )
  })

  test('get_doc returns the page with absolute links', async () => {
    const text = (await call('get_doc', { path: 'how-to/proxy/' })).body.result.content[0].text
    assert.match(text, /Source: https:\/\/example\.test\/how-to\/proxy/)
    assert.match(text, /\(https:\/\/example\.test\/how-to\/configure-cors\)/)
  })

  test('get_doc reports a missing page as a tool error', async () => {
    assert.equal((await call('get_doc', { path: '/nope' })).body.result.isError, true)
  })

  test('list_docs filters by section', async () => {
    const text = (await call('list_docs', { section: 'api' })).body.result.content[0].text
    assert.equal(text, 'No pages in that section.')
  })
})

describe('discovery', () => {
  const discovery = createMcpDiscovery('https://example.test')
  const fetchDoc = async (path, headers = {}) => {
    const probe = http.createServer((req, res) => discovery.handle(req, res, path))
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve))
    try {
      return await new Promise((resolve, reject) => {
        const req = http.request(
          { port: probe.address().port, host: '127.0.0.1', path, headers },
          (res) => {
            let text = ''
            res.on('data', (chunk) => (text += chunk))
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }))
          }
        )
        req.on('error', reject)
        req.end()
      })
    } finally {
      probe.close()
    }
  }

  test('the card names the server and leaves its tools out', async () => {
    const { status, headers, text } = await fetchDoc('/mcp/server-card')
    const card = JSON.parse(text)
    assert.equal(status, 200)
    assert.equal(headers['content-type'], 'application/mcp-server-card+json')
    assert.equal(headers['access-control-allow-origin'], '*')
    assert.equal(card.remotes[0].url, 'https://example.test/mcp')
    assert.ok(card.description.length <= 100)
    assert.equal(card.tools, undefined)
  })

  test('the catalog points at the card', async () => {
    const { headers, text } = await fetchDoc('/.well-known/ai-catalog.json')
    assert.equal(headers['content-type'], 'application/ai-catalog+json')
    assert.equal(JSON.parse(text).entries[0].url, 'https://example.test/mcp/server-card')
  })

  test('an unchanged card answers 304', async () => {
    const { headers } = await fetchDoc('/mcp/server-card')
    const again = await fetchDoc('/mcp/server-card', { 'If-None-Match': headers.etag })
    assert.equal(again.status, 304)
    assert.equal(again.text, '')
  })

  test('a preflight gets the CORS headers and no body', async () => {
    const answer = await new Promise((resolve) => {
      const res = {
        writeHead: (status, headers) => (res.seen = { status, headers }),
        end: () => resolve(res.seen),
      }
      discovery.handle({ method: 'OPTIONS', headers: {} }, res, '/mcp/server-card')
    })
    assert.equal(answer.status, 204)
    assert.equal(answer.headers['Access-Control-Allow-Origin'], '*')
    assert.equal(discovery.serves('OPTIONS', '/mcp/server-card'), true)
  })

  test('it serves reads of its own two paths only', () => {
    assert.equal(discovery.serves('GET', '/mcp/server-card'), true)
    assert.equal(discovery.serves('POST', '/mcp/server-card'), false)
    assert.equal(discovery.serves('GET', '/mcp'), false)
  })
})

describe('the registry entry', () => {
  const entry = JSON.parse(readFileSync(new URL('../server.json', import.meta.url)))

  test('the card describes the version and icon server.json publishes', () => {
    let text
    const res = { writeHead: () => {}, end: (body) => (text = body) }
    createMcpDiscovery('https://druxtjs.org').handle(
      { method: 'GET', headers: {} },
      res,
      '/mcp/server-card'
    )
    const card = JSON.parse(text)
    assert.equal(card.version, entry.version)
    assert.deepEqual(card.icons, entry.icons)
  })

  test('the server reports the version server.json publishes', () => {
    assert.equal(SERVER_VERSION, entry.version)
  })

  test('the icon is a file the site serves, at its declared size', () => {
    const [{ src }] = entry.icons
    const png = readFileSync(new URL(`../nuxt/static${new URL(src).pathname}`, import.meta.url))
    // A PNG's header holds its width and height, so a new icon can't keep an old size.
    assert.deepEqual(entry.icons[0].sizes, [`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`])
  })
})
