// The MCP page is published after the server starts, and cards are drawn only at
// startup, so its card has to exist before the page does.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { cardDocs } = require('../nuxt/lib/og-pages.js')

describe('cardDocs', () => {
  test('adds the MCP page when the corpus has none', () => {
    assert.deepEqual(
      cardDocs([{ route: '/a' }]).map((doc) => doc.route),
      ['/a', '/mcp']
    )
  })

  test('leaves the published page alone', () => {
    const docs = [{ route: '/mcp', title: 'Published', section: 'mcp' }]
    assert.equal(cardDocs(docs), docs)
  })
})
