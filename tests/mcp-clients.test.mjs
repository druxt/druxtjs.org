// Each client's config is a different shape, and a wrong key fails silently in
// the client, so the shapes are pinned here.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

// An ES module in a CommonJS package, which Node 16 can't import by its own name.
const source = fs.readFileSync(new URL('../nuxt/lib/mcp-clients.js', import.meta.url), 'utf8')
const { mcpClients } = await import(`data:text/javascript,${encodeURIComponent(source)}`)

const url = 'https://example.test/mcp'
const client = (name) => mcpClients(url).find((c) => c.name === name)

describe('mcpClients', () => {
  test('offers the clients the page promises, in order', () => {
    assert.deepEqual(
      mcpClients(url).map((c) => c.name),
      ['Claude Code', 'Cursor', 'VS Code', 'OpenCode']
    )
  })

  test('Claude Code gets a command', () => {
    assert.equal(client('Claude Code').code, `claude mcp add --transport http druxt ${url}`)
  })

  test("each config file has its client's own shape", () => {
    assert.deepEqual(JSON.parse(client('Cursor').code), { mcpServers: { druxt: { url } } })
    assert.deepEqual(JSON.parse(client('VS Code').code), {
      servers: { druxt: { type: 'http', url } },
    })
    assert.deepEqual(JSON.parse(client('OpenCode').code), {
      mcp: { druxt: { type: 'remote', url } },
    })
  })

  test('the Cursor link carries the settings without the name', () => {
    const link = new URL(client('Cursor').install)
    assert.equal(link.searchParams.get('name'), 'druxt')
    assert.deepEqual(JSON.parse(atob(link.searchParams.get('config'))), { url })
  })
})
