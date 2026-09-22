import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { PACKAGES, snapshotOf, applySnapshot, applyDocs } = await import(
  '../scripts/dev-snapshot.mjs'
)

const tags = (stamp, overrides = {}) =>
  Object.fromEntries(PACKAGES.map((name) => [name, overrides[name] || `1.0.0-dev.${stamp}`]))

describe('snapshotOf', () => {
  it('takes the build every package shares', () => {
    assert.equal(snapshotOf(tags('20260921034536')).stamp, '20260921034536')
  })

  it('refuses packages from different builds, which would install two copies of Druxt', () => {
    assert.throws(
      () => snapshotOf(tags('20260921034536', { 'druxt-menu': '0.21.1-dev.20260920043715' })),
      /same build/
    )
  })

  it('refuses a package with no dev release', () => {
    const partial = tags('20260921034536')
    delete partial['druxt-views']
    assert.throws(() => snapshotOf(partial), /druxt-views/)
  })
})

describe('applySnapshot', () => {
  const pkg = () => ({
    dependencies: { druxt: '0.24.0', 'druxt-menu': '0.21.0', nuxt: '2.18.1' },
    resolutions: { ws: '7.5.11' },
  })

  it('pins every Druxt package in dependencies and resolutions', () => {
    const out = applySnapshot(pkg(), { druxt: '0.25.0-dev.1', 'druxt-menu': '0.21.1-dev.1' })
    assert.equal(out.dependencies.druxt, '0.25.0-dev.1')
    assert.equal(out.resolutions['druxt-menu'], '0.21.1-dev.1')
    assert.equal(out.dependencies.nuxt, '2.18.1')
    assert.equal(out.resolutions.ws, '7.5.11')
  })

  it('pins Vue, its renderer and its compiler to one version', () => {
    const out = applySnapshot(pkg(), { druxt: '0.25.0-dev.1' })
    for (const name of ['vue', 'vue-server-renderer', 'vue-template-compiler']) {
      assert.equal(out.resolutions[name], '2.7.16')
    }
  })
})

describe('applyDocs', () => {
  it('generates the reference at the commit, with the pending changelog', () => {
    const out = applyDocs(
      { repository: 'r', ref: 'a'.repeat(40) },
      'b'.repeat(40),
      '20260921034536'
    )
    assert.deepEqual(out, {
      repository: 'r',
      ref: 'a'.repeat(40),
      docgenRef: 'b'.repeat(40),
      snapshot: '20260921034536',
    })
  })

  it('refuses anything but a full commit sha', () => {
    assert.throws(() => applyDocs({ ref: 'a' }, 'develop', '20260921034536'), /commit/)
  })
})

const { commitFor, main } = await import('../scripts/dev-snapshot.mjs')
const { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } = await import('node:fs')
const { tmpdir } = await import('node:os')
const path = await import('node:path')

const runs = [
  {
    head_sha: 'c'.repeat(40),
    run_started_at: '2026-09-21T05:00:00Z',
    updated_at: '2026-09-21T05:10:00Z',
  },
  {
    head_sha: 'b'.repeat(40),
    run_started_at: '2026-09-21T03:40:00Z',
    updated_at: '2026-09-21T03:50:00Z',
  },
]

describe('commitFor', () => {
  it('names the commit of the run that was publishing when the build was stamped', () => {
    assert.equal(commitFor(runs, '20260921034536'), 'b'.repeat(40))
  })

  it('refuses a build no run accounts for, rather than guess its commit', () => {
    assert.throws(() => commitFor(runs, '20260921043000'), /No druxt.js Release run/)
  })
})

describe('main', () => {
  const checkout = () => {
    const root = mkdtempSync(path.join(tmpdir(), 'dev-snapshot-'))
    mkdirSync(path.join(root, 'nuxt'))
    writeFileSync(
      path.join(root, 'nuxt/package.json'),
      JSON.stringify({ dependencies: { druxt: '0.24.0' }, resolutions: {} })
    )
    writeFileSync(
      path.join(root, 'docs-source.json'),
      JSON.stringify({ repository: 'r', ref: 'a'.repeat(40) })
    )
    return root
  }
  const from = { devTag: async () => `1.0.0-dev.20260921034536`, releaseRuns: async () => runs }

  it('writes the snapshot into the checkout', async () => {
    const root = checkout()
    try {
      const out = await main({ root, from })
      assert.equal(out.sha, 'b'.repeat(40))
      assert.equal(
        JSON.parse(readFileSync(path.join(root, 'nuxt/package.json'))).dependencies.druxt,
        '1.0.0-dev.20260921034536'
      )
      const docs = JSON.parse(readFileSync(path.join(root, 'docs-source.json')))
      assert.equal(docs.docgenRef, 'b'.repeat(40))
      assert.equal(docs.snapshot, '20260921034536')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('changes nothing when only checking', async () => {
    const root = checkout()
    try {
      await main({ root, from, check: true })
      assert.equal(
        JSON.parse(readFileSync(path.join(root, 'nuxt/package.json'))).dependencies.druxt,
        '0.24.0'
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('sources', async () => {
  const { sources } = await import('../scripts/dev-snapshot.mjs')
  const realFetch = globalThis.fetch
  const calls = []
  const answer = (status, body) => async (url, init) => {
    calls.push({ url, headers: init.headers })
    return { ok: status === 200, status, json: async () => body }
  }

  it('reads the dev tag from the npm registry', async (t) => {
    t.after(() => (globalThis.fetch = realFetch))
    globalThis.fetch = answer(200, { latest: '0.24.0', dev: '0.25.0-dev.1' })
    assert.equal(await sources.devTag('druxt'), '0.25.0-dev.1')
    assert.match(calls.at(-1).url, /registry\.npmjs\.org\/-\/package\/druxt\/dist-tags$/)
  })

  it("reads druxt.js's successful Release runs on develop, with a token when there is one", async (t) => {
    const saved = process.env.GITHUB_TOKEN
    t.after(() => {
      globalThis.fetch = realFetch
      if (saved === undefined) delete process.env.GITHUB_TOKEN
      else process.env.GITHUB_TOKEN = saved
    })
    globalThis.fetch = answer(200, { workflow_runs: runs })
    process.env.GITHUB_TOKEN = 'token'
    assert.deepEqual(await sources.releaseRuns(), runs)
    assert.match(
      calls.at(-1).url,
      /druxt\.js\/actions\/workflows\/release\.yml\/runs\?branch=develop&event=push&status=success/
    )
    assert.equal(calls.at(-1).headers.Authorization, 'Bearer token')
    delete process.env.GITHUB_TOKEN
    await sources.releaseRuns()
    assert.equal(calls.at(-1).headers.Authorization, undefined)
  })

  it('fails on an error answer rather than read it as data', async (t) => {
    t.after(() => (globalThis.fetch = realFetch))
    globalThis.fetch = answer(503, {})
    await assert.rejects(sources.devTag('druxt'), /answered 503/)
  })
})
