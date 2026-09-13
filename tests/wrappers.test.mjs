// The Druxt wrapper components, read as files: the traps a wrapper can fall
// into are visible in its source.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../nuxt/components/druxt/', import.meta.url).pathname

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.vue') ? [path] : []
  })

/** The source without its comments, which may name the very things looked for. */
const code = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/<!--[\s\S]*?-->/g, '')

const wrappers = walk(ROOT).map((path) => ({
  path: path.slice(ROOT.length),
  source: code(readFileSync(path, 'utf8')),
}))

describe('wrappers', () => {
  test('there are wrappers to check', () => {
    assert.ok(wrappers.length > 10, `found ${wrappers.length}`)
  })

  test('a wrapper that fetches keeps the attributes Nuxt hydrates it by', () => {
    // Nuxt stamps data-fetch-key on the root through the parent's attributes;
    // inheritAttrs: false drops it, and the browser runs fetch() again.
    const offenders = wrappers
      .filter(
        ({ source }) =>
          /\bfetch\s*\(\s*\)\s*\{/.test(source) && /inheritAttrs:\s*false/.test(source)
      )
      .map(({ path }) => path)
    assert.deepEqual(offenders, [])
  })
})
