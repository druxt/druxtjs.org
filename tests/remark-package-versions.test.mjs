import assert from 'node:assert/strict'
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
      '@druxt-contrib/diff@1.0.0',
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
