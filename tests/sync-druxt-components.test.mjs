// Which auto-imported components load with the page rather than as chunks.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const { syncDruxtComponents } = (await import('../nuxt/lib/sync-druxt-components.js')).default

describe('syncDruxtComponents', () => {
  test('marks every Druxt package component synchronous, and nothing else', () => {
    const components = [
      { filePath: '/app/node_modules/druxt/dist/components/DruxtWrapper.vue', isAsync: null },
      { filePath: '/app/node_modules/druxt-blocks/dist/components/DruxtBlock.vue', isAsync: null },
      {
        filePath:
          '/app/node_modules/druxt-layout-paragraphs/dist/components/DruxtLayoutParagraph.vue',
        isAsync: null,
      },
      { filePath: '/app/components/druxt/entity/Default.vue', isAsync: null },
      { filePath: '/app/node_modules/@nuxt/content/dist/x.vue', isAsync: null },
    ]
    syncDruxtComponents(components)
    assert.deepEqual(
      components.map((c) => c.isAsync),
      [false, false, false, null, null]
    )
  })
})
