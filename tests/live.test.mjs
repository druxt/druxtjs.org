import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { isContentChange, tagsFrom, watchPurges } = require('../nuxt/server/live.js')

// A server that watches purges ahead of a handler answering as druxt's cache
// clear does: without reading the body.
const withServer = async (status, callback) => {
  const purges = []
  const watch = watchPurges((tags) => purges.push(tags))
  const server = http.createServer((req, res) => {
    watch(req, res)
    res.writeHead(status)
    res.end()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const post = (path, body) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port: server.address().port, path, method: 'POST' },
        (res) => {
          res.resume()
          res.on('end', () => setTimeout(resolve, 20))
        }
      )
      req.on('error', reject)
      req.end(body)
    })
  try {
    await callback(post, purges)
  } finally {
    server.close()
  }
}

describe('tagsFrom', () => {
  test('splits and trims the comma separated tags', () => {
    assert.deepEqual(tagsFrom('node:1, node_list ,config:system.menu.docs'), [
      'node:1',
      'node_list',
      'config:system.menu.docs',
    ])
  })

  test('drops anything that is not a tag', () => {
    assert.deepEqual(tagsFrom('node:1,<script>,,a b'), ['node:1'])
  })

  test('reads a body too big to keep as everything', () => {
    assert.deepEqual(tagsFrom('node:1,'.repeat(20000)), [])
  })
})

describe('isContentChange', () => {
  test('is false for sign-in bookkeeping alone', () => {
    assert.equal(isContentChange(['oauth2_token:5', 'consumer_list', 'session']), false)
  })

  test('is true when any tag is content, or for everything', () => {
    assert.equal(isContentChange(['oauth2_token:5', 'node:1']), true)
    assert.equal(isContentChange([]), true)
  })
})

describe('watchPurges', () => {
  test('hands on the tags of a purge druxt accepts', async () => {
    await withServer(204, async (post, purges) => {
      await post('/_druxt/cache/clear', 'node:1,node_list')
      assert.deepEqual(purges, [['node:1', 'node_list']])
    })
  })

  test('ignores a purge druxt refuses', async () => {
    await withServer(401, async (post, purges) => {
      await post('/_druxt/cache/clear', 'node:1')
      assert.deepEqual(purges, [])
    })
  })

  test('ignores other paths, and a batch of bookkeeping', async () => {
    await withServer(204, async (post, purges) => {
      await post('/jsonapi/node/doc_page', 'node:1')
      await post('/_druxt/cache/clear', 'oauth2_token:7,consumer:1')
      assert.deepEqual(purges, [])
    })
  })

  test('reads an oversized batch as everything', async () => {
    await withServer(204, async (post, purges) => {
      await post('/_druxt/cache/clear', 'node:1,'.repeat(20000))
      assert.deepEqual(purges, [[]])
    })
  })
})
