// The server's contract is the protocol: an AI tool that gets a malformed answer
// drops the server without saying why, so each exchange goes over real HTTP.
//
//   node --test "tests/*.test.mjs"

import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { createDocsMcp, isMcpRequest, searchDocs } = require('../nuxt/server/docs-mcp.js')

const docs = [
  { route: '/how-to/proxy', title: 'Proxy the backend', description: 'Through Nuxt.', section: 'how-to', content: 'See [CORS](/how-to/configure-cors).' },
  { route: '/how-to/configure-cors', title: 'Configure CORS', description: 'In Drupal.', section: 'how-to', content: 'A proxy avoids this.' },
  { route: '/api/packages/druxt/CHANGELOG', title: 'Changelog', section: 'api', content: 'proxy proxy proxy' },
]

let server
let url
const post = async (body, raw = false) => {
  const res = await fetch(url, { method: 'POST', body: raw ? body : JSON.stringify(body) })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers }
}
const call = (name, args) =>
  post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })

before(async () => {
  server = http.createServer(createDocsMcp({ corpus: async () => docs, origin: 'https://example.test' }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}/mcp`
})
after(() => server.close())

describe('the protocol', () => {
  test('initialize agrees a version it knows, and offers tools', async () => {
    const { body } = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })
    assert.equal(body.result.protocolVersion, '2025-03-26')
    assert.deepEqual(body.result.capabilities, { tools: {} })
  })

  test('initialize answers an unknown version with its own latest', async () => {
    const { body } = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } })
    assert.equal(body.result.protocolVersion, '2025-06-18')
  })

  test('a notification gets 202 and no body', async () => {
    const { status, body } = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
    assert.equal(status, 202)
    assert.equal(body, null)
  })

  test('every tool is marked read-only', async () => {
    const { body } = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
    assert.deepEqual(body.result.tools.map((t) => t.name), ['search_docs', 'list_docs', 'get_doc'])
    assert.ok(body.result.tools.every((t) => t.annotations.readOnlyHint))
  })

  test('refuses GET, broken JSON, a batch, an unknown method and an oversized body', async () => {
    assert.equal((await fetch(url)).status, 405)
    assert.equal((await post('{', true)).body.error.code, -32700)
    assert.equal((await post([{ jsonrpc: '2.0', id: 1, method: 'ping' }])).status, 400)
    assert.equal((await post({ jsonrpc: '2.0', id: 1, method: 'nope' })).body.error.code, -32601)
    assert.equal((await post('x'.repeat(70000), true)).status, 413)
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
  test('search ranks a title match first and leaves changelogs out', () => {
    assert.deepEqual(searchDocs(docs, 'proxy').map((d) => d.route), ['/how-to/proxy', '/how-to/configure-cors'])
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
