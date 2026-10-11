import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, test } from 'node:test'

const require = createRequire(import.meta.url)
const { fixPackageVersions, isPackageVersion } = require('../nuxt/lib/remark-package-versions.js')

const mailto = (address) => ({
  type: 'link',
  url: `mailto:${address}`,
  children: [{ type: 'text', value: address }],
})

describe('remark-package-versions', () => {
  test('a package version GFM read as an address is one', () => {
    for (const address of [
      'druxt@0.24.0',
      'druxt-blocks@0.17.1',
      'druxt@0.25.0-dev.20261006113740',
      'druxt@1.0.0-beta.1',
    ]) {
      assert.ok(isPackageVersion(mailto(address)), address)
    }
  })

  test('a real address, and any other link, is left alone', () => {
    for (const node of [
      mailto('hello@druxtjs.org'),
      mailto('someone@example.com'),
      { type: 'link', url: 'https://druxtjs.org', children: [] },
      { type: 'text', value: 'druxt@0.24.0' },
    ]) {
      assert.equal(isPackageVersion(node), false, JSON.stringify(node))
    }
  })

  test('a scoped package is linked only past its slash, and that part becomes code', () => {
    // GFM's address never takes a slash, so `@druxt-contrib/` stays text.
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '@druxt-contrib/' }, mailto('diff@1.0.0')],
        },
      ],
    }
    const [paragraph] = fixPackageVersions(tree).children
    assert.deepEqual(
      paragraph.children.map((node) => [node.type, node.value || node.url]),
      [
        ['text', '@druxt-contrib/'],
        ['inlineCode', 'diff@1.0.0'],
      ]
    )
  })

  test('walks into a list item and a table cell, where a changelog line can also sit', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'list',
          children: [
            {
              type: 'listItem',
              children: [{ type: 'paragraph', children: [mailto('druxt@0.22.0')] }],
            },
          ],
        },
        {
          type: 'table',
          children: [
            {
              type: 'tableRow',
              children: [{ type: 'tableCell', children: [mailto('druxt-menu@0.19.0')] }],
            },
          ],
        },
      ],
    }
    const [list, table] = fixPackageVersions(tree).children
    assert.equal(list.children[0].children[0].children[0].type, 'inlineCode')
    assert.equal(table.children[0].children[0].children[0].value, 'druxt-menu@0.19.0')
  })

  test('is wired into the content module by the path Nuxt resolves', () => {
    // The config pulls in the app's modules, so it is read as text here.
    const config = readFileSync(new URL('../nuxt/nuxt.config.js', import.meta.url), 'utf8')
    assert.match(config, /remarkPlugins: \['~\/lib\/remark-package-versions\.js'\]/)
    assert.ok(existsSync(new URL('../nuxt/lib/remark-package-versions.js', import.meta.url)))
    // What the content module calls: the export is a plugin, and attaching it
    // yields the transformer.
    const plugin = require('../nuxt/lib/remark-package-versions.js')
    assert.equal(typeof plugin, 'function')
    assert.equal(typeof plugin(), 'function')
  })

  test('a changelog line keeps its text, with each package as code', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Updated dependencies: ' },
            mailto('druxt@0.22.0'),
            { type: 'text', value: ', ' },
            mailto('druxt-blocks@0.17.1'),
            { type: 'text', value: '. Mail ' },
            mailto('hello@druxtjs.org'),
          ],
        },
      ],
    }
    const [paragraph] = fixPackageVersions(tree).children
    assert.deepEqual(
      paragraph.children.map((node) => [node.type, node.value || node.url]),
      [
        ['text', 'Updated dependencies: '],
        ['inlineCode', 'druxt@0.22.0'],
        ['text', ', '],
        ['inlineCode', 'druxt-blocks@0.17.1'],
        ['text', '. Mail '],
        ['link', 'mailto:hello@druxtjs.org'],
      ]
    )
  })
})
