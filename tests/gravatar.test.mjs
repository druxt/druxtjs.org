import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'

const { HOST, emailHash, gravatarUrl, normalise } = (await import('../nuxt/lib/gravatar.js'))
  .default

describe('normalise', () => {
  it('trims and lower cases the address, as Gravatar hashes it', () => {
    assert.equal(normalise('  Editor@Example.COM '), 'editor@example.com')
    assert.equal(normalise(undefined), '')
  })
})

describe('gravatarUrl', () => {
  it('asks for the size, and for a 404 rather than a generated face', () => {
    assert.equal(gravatarUrl('abc', 56), `${HOST}/abc?s=56&d=404`)
  })

  it('never sends the address itself', () => {
    const url = gravatarUrl('abc', 56)
    assert.doesNotMatch(url, /@/)
  })
})

describe('emailHash', () => {
  it('is the SHA-256 of the normalised address', async () => {
    assert.equal(
      await emailHash(' Demo-Editor@Example.com ', webcrypto.subtle),
      '751bb458135072bbac6d9b5f6326af90af9a959a6c51e3ad5a5c0f422285691d'
    )
  })

  it('is null without an address, and where the browser cannot hash', async () => {
    assert.equal(await emailHash('', webcrypto.subtle), null)
    assert.equal(await emailHash('editor@example.com', null), null)
    assert.equal(
      await emailHash('editor@example.com', { digest: () => Promise.reject(new Error('no')) }),
      null
    )
  })
})
