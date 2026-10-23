// The pre-cache warm: once at start, again after each clear from Drupal, one
// at a time, and never holding the start past its timeout.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { CLEAR_PATH, createWarmer } = require('../nuxt/server/warm.js')

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// A crawl that counts its runs and takes `ms` to finish.
const counting = (ms = 0) => {
  const calls = []
  const crawler = async ({ seeds }) => {
    calls.push(seeds)
    await wait(ms)
    return { stored: seeds.length, visited: seeds.length }
  }
  return { calls, crawler }
}

const warmer = (options) =>
  createWarmer({ seeds: async () => ['/', '/a'], store: async () => '', delay: 10, ...options })

// A response that finishes with a status, the way Node's ServerResponse does.
const respond = (handler, method, url, statusCode) => {
  const res = new EventEmitter()
  handler({ method, url }, res)
  res.statusCode = statusCode
  res.emit('finish')
}

describe('createWarmer', () => {
  test('the first warm crawls the seeds and logs the count', async () => {
    const { calls, crawler } = counting()
    const lines = []
    const result = await warmer({ crawler, log: (line) => lines.push(line) }).first()
    assert.deepEqual(result, { stored: 2, visited: 2 })
    assert.deepEqual(calls, [['/', '/a']])
    assert.match(lines[0], /^warmed 2 of 2 pages in \d+s$/)
  })

  test('the first warm stops holding the start at its timeout', async () => {
    const { crawler } = counting(200)
    const started = Date.now()
    assert.equal(await warmer({ crawler, timeout: 20 }).first(), null)
    assert.ok(Date.now() - started < 150)
  })

  test('a burst of clears warms once', async () => {
    const { calls, crawler } = counting()
    const w = warmer({ crawler })
    w.schedule()
    w.schedule()
    w.schedule()
    await wait(50)
    assert.equal(calls.length, 1)
  })

  test('a clear during a warm warms once more after it', async () => {
    const { calls, crawler } = counting(30)
    const w = warmer({ crawler })
    const first = w.run()
    w.run()
    w.run()
    await first
    assert.equal(calls.length, 1)
    await wait(80)
    assert.equal(calls.length, 2)
  })

  test('a failed crawl is logged and the next warm still runs', async () => {
    const lines = []
    let fail = true
    const crawler = async () => {
      if (fail) throw new Error('backend down')
      return { stored: 1, visited: 1 }
    }
    const w = warmer({ crawler, log: (line) => lines.push(line) })
    assert.equal(await w.run(), null)
    assert.equal(lines[0], 'warm failed: backend down')
    fail = false
    assert.deepEqual(await w.run(), { stored: 1, visited: 1 })
  })

  test('the first warm follows links and a refresh stops at its own paths', async () => {
    const seen = []
    const crawler = async (options) => {
      seen.push(options)
      return { stored: 1, visited: 1 }
    }
    const w = warmer({
      crawler,
      seeds: async () => ['/', '/a', '/generated'],
      refresh: async () => ['/', '/a'],
    })
    await w.first()
    await w.run()
    assert.deepEqual(seen[0].seeds, ['/', '/a', '/generated'])
    assert.equal(seen[0].limit, undefined)
    assert.deepEqual(seen[1].seeds, ['/', '/a'])
    assert.equal(seen[1].limit, 2)
  })

  test('during the first warm only a clear reaches the live handler', () => {
    const w = warmer({ crawler: counting().crawler })
    const seen = []
    const handler = w.routeClears(
      (req) => seen.push(`starting ${req.method} ${req.url}`),
      (req) => seen.push(`live ${req.method} ${req.url}`)
    )
    handler({ method: 'POST', url: `${CLEAR_PATH}?x=1` }, {})
    handler({ method: 'GET', url: CLEAR_PATH }, {})
    handler({ method: 'POST', url: '/how-to/caching' }, {})
    handler({ method: 'GET', url: '/' }, {})
    assert.deepEqual(seen, [
      `live POST ${CLEAR_PATH}?x=1`,
      `starting GET ${CLEAR_PATH}`,
      'starting POST /how-to/caching',
      'starting GET /',
    ])
  })

  test('only a successful POST to the clear endpoint schedules a warm', async () => {
    const { calls, crawler } = counting()
    const w = warmer({ crawler })
    const passed = []
    const handler = w.watchClears((req) => passed.push(req.url))
    respond(handler, 'POST', CLEAR_PATH, 401)
    respond(handler, 'GET', CLEAR_PATH, 405)
    respond(handler, 'POST', '/how-to/caching', 204)
    await wait(40)
    assert.equal(calls.length, 0)
    respond(handler, 'POST', `${CLEAR_PATH}?from=purge`, 204)
    await wait(40)
    assert.equal(calls.length, 1)
    assert.equal(passed.length, 4)
  })
})
