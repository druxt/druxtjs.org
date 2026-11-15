// Links an editor sets: a page of the site goes through the router, and
// anything else is a plain link, since the router would read it as a path.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'

const { isExternal } = await import('../nuxt/utils/link.js')

const HOME = 'nuxt/components/app/home'

describe('isExternal', () => {
  test('a path of the site is not external', () => {
    for (const url of [
      '/',
      '/modules',
      '/how-to/example-apps#list',
      'modules',
      '?page=2',
      '#top',
      '',
    ]) {
      assert.equal(isExternal(url), false, url)
    }
  })

  test('a link with a scheme or a host is external', () => {
    for (const url of [
      'https://github.com/druxt',
      'http://example.com',
      'HTTPS://example.com',
      'mailto:a@example.com',
      '//example.com/x',
    ]) {
      assert.equal(isExternal(url), true, url)
    }
  })

  test('a missing link is not external', () => {
    assert.equal(isExternal(undefined), false)
    assert.equal(isExternal(null), false)
  })
})

describe("the front page's components", () => {
  const files = readdirSync(HOME).filter((file) => file.endsWith('.vue'))

  test('there are components to check', () => {
    assert.ok(files.length >= 7)
  })

  // Each link's destination is a prop an editor fills in Canvas, whose
  // schema takes any URI.
  for (const file of files) {
    test(`${file} hands no link straight to the router`, () => {
      assert.doesNotMatch(readFileSync(`${HOME}/${file}`, 'utf8'), /<NuxtLink\b/)
    })
  }
})

describe('the quickstart command', () => {
  const source = readFileSync(`${HOME}/QuickstartCommand.vue`, 'utf8')

  test('names its radio groups and its panel per instance', () => {
    // A fixed name would join the radios of two blocks on one page into one group.
    assert.doesNotMatch(source, /\sname="/)
    assert.doesNotMatch(source, /\sid="/)
    assert.equal(source.match(/:name="`[a-z-]+-\$\{_uid\}`"/g).length, 2)
  })

  test('reports a copy only while it is the latest one for the command shown', () => {
    // A copy that ends late must not label a command picked, or copied again, since.
    assert.match(source, /const operation = \+\+this\.operation/)
    assert.equal(source.match(/operation !== this\.operation\) return/g).length, 2)
    assert.match(source, /command\(\) \{\s+this\.operation\+\+/)
  })
})
