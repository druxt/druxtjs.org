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
const request = (method, body, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let text = ''
      res.on('data', (chunk) => (text += chunk))
      res.on('end', () => resolve({ status: res.statusCode, text }))
    })
    req.on('error', reject)
    req.end(body)
  })
const post = async (body, raw = false, headers = {}) => {
  const { status, text } = await request('POST', raw ? body : JSON.stringify(body), headers)
  return { status, body: text ? JSON.parse(text) : null }
}
const VERSION = '2026-07-28'
const META_VERSION = 'io.modelcontextprotocol/protocolVersion'
const META_CAPABILITIES = 'io.modelcontextprotocol/clientCapabilities'
const SERVER_INFO = 'io.modelcontextprotocol/serverInfo'
// A request as the current revision sends one: the version in `_meta`, and the
// headers that repeat what the body says. A test that needs one of those wrong
// builds its own headers instead.
const current = (message, headers = {}) => {
  const params = {
    ...(message.params || {}),
    _meta: { [META_VERSION]: VERSION, [META_CAPABILITIES]: {} },
  }
  return post({ ...message, params }, false, {
    'MCP-Protocol-Version': VERSION,
    'Mcp-Method': message.method,
    ...(params.name ? { 'Mcp-Name': params.name } : {}),
    ...headers,
  })
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
    const unknown = await post({ jsonrpc: '2.0', id: 1, method: 'nope' })
    assert.equal(unknown.body.error.code, -32601)
    // A method the server doesn't have is 404, which a client reads apart from
    // a 404 for a path that is no MCP endpoint by the error in the body.
    assert.equal(unknown.status, 404)
    assert.equal((await post('x'.repeat(70000), true)).status, 413)
  })
})

describe('the current revision', () => {
  test('server/discover names the versions, the tools and how long to hold them', async () => {
    const { status, body } = await current({ jsonrpc: '2.0', id: 1, method: 'server/discover' })
    assert.equal(status, 200)
    assert.equal(body.result.resultType, 'complete')
    assert.equal(body.result.supportedVersions[0], VERSION)
    assert.deepEqual(body.result.capabilities, { tools: {} })
    assert.equal(body.result.cacheScope, 'public')
    assert.ok(body.result.ttlMs > 0)
    assert.equal(body.result._meta[SERVER_INFO].version, SERVER_VERSION)
  })

  test('tools/list comes back cacheable, in one order', async () => {
    const { body } = await current({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    assert.equal(body.result.cacheScope, 'public')
    assert.ok(body.result.ttlMs > 0)
    assert.deepEqual(
      body.result.tools.map((t) => t.name),
      ['search_docs', 'list_docs', 'get_doc']
    )
  })

  test('a tool is called when the name in the header is the name in the body', async () => {
    const message = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'get_doc', arguments: { path: '/how-to/proxy' } },
    }
    assert.match((await current(message)).body.result.content[0].text, /Proxy the backend/)
    // A name that isn't plain ASCII arrives encoded, so an encoded one that
    // decodes to the name in the body is the same request.
    const encoded = `=?base64?${Buffer.from('get_doc').toString('base64')}?=`
    const { body } = await current(message, { 'Mcp-Name': encoded })
    assert.match(body.result.content[0].text, /Proxy the backend/)
  })

  test('an answer says what kind it is and who gave it', async () => {
    const { body } = await current({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    assert.equal(body.result.resultType, 'complete')
    assert.deepEqual(body.result._meta[SERVER_INFO], {
      name: createMcpDiscovery('https://example.test').name,
      version: SERVER_VERSION,
    })
  })

  test('a header that disagrees with the body is refused, and nothing is answered from it', async () => {
    const list = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: { _meta: { [META_VERSION]: VERSION } },
    }
    const headerMismatch = async (message, headers) => {
      const { status, body } = await post(message, false, headers)
      assert.equal(status, 400)
      assert.equal(body.error.code, -32020)
      assert.equal(body.result, undefined)
    }
    // The version is stated in the body and nowhere in the headers.
    await headerMismatch(list, { 'Mcp-Method': 'tools/list' })
    // The two versions differ.
    await headerMismatch(list, { 'MCP-Protocol-Version': '2025-06-18', 'Mcp-Method': 'tools/list' })
    // Both are older revisions, and still not the same one.
    await headerMismatch(
      { ...list, params: { _meta: { [META_VERSION]: '2025-03-26' } } },
      { 'MCP-Protocol-Version': '2025-06-18' }
    )
    // The method does not.
    await headerMismatch(list, { 'MCP-Protocol-Version': VERSION, 'Mcp-Method': 'tools/call' })
    await headerMismatch(list, { 'MCP-Protocol-Version': VERSION })
    // A tool is called without naming it in the headers.
    await headerMismatch(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_doc', arguments: {}, _meta: { [META_VERSION]: VERSION } },
      },
      { 'MCP-Protocol-Version': VERSION, 'Mcp-Method': 'tools/call' }
    )
    // A tool is named in the headers, and it is another tool, plain or encoded.
    const getDoc = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'get_doc', arguments: {}, _meta: { [META_VERSION]: VERSION } },
    }
    const toolHeaders = { 'MCP-Protocol-Version': VERSION, 'Mcp-Method': 'tools/call' }
    await headerMismatch(getDoc, { ...toolHeaders, 'Mcp-Name': 'search_docs' })
    await headerMismatch(getDoc, {
      ...toolHeaders,
      'Mcp-Name': `=?base64?${Buffer.from('search_docs').toString('base64')}?=`,
    })
  })

  test('a request that states its version to a proxy and not to the server is refused', async () => {
    // The header reaches whatever routes the request. The body is what the
    // server reads, and the revision requires the version in both.
    const { status, body } = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, false, {
      'MCP-Protocol-Version': VERSION,
      'Mcp-Method': 'tools/list',
    })
    assert.equal(status, 400)
    assert.equal(body.error.code, -32602)
    assert.equal(body.result, undefined)
  })

  test('a version that is not a string is answered, not thrown', async () => {
    // `{ toString: null }` cannot be read as a string at all, and a throw on
    // the way into the answer would leave the request hanging and the process
    // holding an unhandled rejection.
    const { status, body } = await post(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: { [META_VERSION]: { toString: null } } },
      },
      false,
      { 'Mcp-Method': 'tools/list' }
    )
    assert.equal(status, 400)
    assert.equal(body.error.code, -32602)
    // The server is still there afterwards.
    assert.equal((await post({ jsonrpc: '2.0', id: 2, method: 'ping' })).status, 200)
  })

  test('a request without client capabilities is still answered', async () => {
    // The revision asks a client to state its capabilities on every request,
    // and this server asks nothing of a client: no sampling, no elicitation,
    // no roots. Turning a readable request away over a field that is never
    // read would cost a reader the docs and buy nothing. A feature that needs
    // a client capability would have to require the field.
    const { status, body } = await post(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: { [META_VERSION]: VERSION } },
      },
      false,
      { 'MCP-Protocol-Version': VERSION, 'Mcp-Method': 'tools/list' }
    )
    assert.equal(status, 200)
    assert.equal(body.result.tools.length, 3)
  })

  test('a revision it does not speak is told which ones it does', async () => {
    const { status, body } = await post(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: { [META_VERSION]: '2025-11-25' } },
      },
      false,
      { 'MCP-Protocol-Version': '2025-11-25', 'Mcp-Method': 'tools/list' }
    )
    assert.equal(status, 400)
    assert.equal(body.error.code, -32022)
    assert.equal(body.error.data.requested, '2025-11-25')
    assert.ok(body.error.data.supported.includes(VERSION))
  })

  test('a client of an older revision is answered as before', async () => {
    // The version header alone, no `_meta` and none of the headers the current
    // revision requires: the shape every client sent until this one.
    const { status, body } = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, false, {
      'MCP-Protocol-Version': '2025-06-18',
      'Mcp-Session-Id': 'ignored',
    })
    assert.equal(status, 200)
    assert.equal(body.result.tools.length, 3)
    assert.equal(body.result.resultType, 'complete')
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

  test('the card repeats every field server.json publishes', () => {
    let text
    const res = { writeHead: () => {}, end: (body) => (text = body) }
    createMcpDiscovery('https://druxtjs.org').handle(
      { method: 'GET', headers: {} },
      res,
      '/mcp/server-card'
    )
    const card = JSON.parse(text)
    // The registry publishes an entry by its name.
    assert.equal(card.name, entry.name)
    assert.equal(card.version, entry.version)
    assert.deepEqual(card.icons, entry.icons)
    // The card and the registry entry are written out separately, so a field
    // changed in one and not the other would otherwise go unnoticed until a
    // directory showed the two descriptions side by side.
    assert.equal(card.title, entry.title)
    assert.equal(card.description, entry.description)
    assert.equal(card.websiteUrl, entry.websiteUrl)
    assert.deepEqual(card.repository, entry.repository)
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
