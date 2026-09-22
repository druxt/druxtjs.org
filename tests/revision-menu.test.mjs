import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const { hasDraft, kindOf, versionOf, viewing, whenOf } = (await import('../nuxt/lib/revisions.js')).default

const draft = { vid: 125, latest: true, default: false }
const live = { vid: 120, latest: false, default: true }
const old = { vid: 90, latest: false, default: false }

describe('whenOf', () => {
  const now = new Date(2026, 8, 22, 12, 0)
  it('gives the time for today and the date otherwise', () => {
    assert.equal(whenOf(new Date(2026, 8, 22, 10, 42).toISOString(), now), 'Today, 10:42')
    assert.equal(whenOf(new Date(2026, 8, 2, 9, 0).toISOString(), now), '2 Sep 2026')
  })

  it('is empty for a date it cannot read', () => {
    assert.equal(whenOf('not a date', now), '')
  })
})

describe('kindOf and versionOf', () => {
  it('name the live revision, a pending draft and the rest', () => {
    assert.deepEqual([live, draft, old].map(kindOf), ['live', 'draft', 'old'])
    assert.deepEqual([live, draft, old].map(versionOf), ['published', 'working-copy', 'id:90'])
  })

  it('call the latest revision live when it is also the default', () => {
    assert.equal(kindOf({ vid: 1, latest: true, default: true }), 'live')
  })
})

describe('hasDraft', () => {
  it('is true only with a pending draft', () => {
    assert.equal(hasDraft([draft, live, old]), true)
    assert.equal(hasDraft([{ ...live, latest: true }, old]), false)
    assert.equal(hasDraft(undefined), false)
  })
})

describe('viewing', () => {
  it('reads the working copy as the draft when there is one, and as live when not', () => {
    assert.deepEqual(viewing([draft, live], 'working-copy'), { kind: 'draft', revision: draft })
    assert.deepEqual(viewing([{ ...live, latest: true }], 'working-copy'), { kind: 'live', revision: { ...live, latest: true } })
  })

  it('finds a revision by id, and knows an id that is the live one', () => {
    assert.deepEqual(viewing([draft, live, old], 'id:90'), { kind: 'old', revision: old })
    assert.deepEqual(viewing([draft, live, old], 'id:120'), { kind: 'live', revision: live })
  })

  it('treats published and nothing as live', () => {
    assert.equal(viewing([draft, live], 'published').kind, 'live')
    assert.equal(viewing([], undefined).kind, 'live')
  })
})
