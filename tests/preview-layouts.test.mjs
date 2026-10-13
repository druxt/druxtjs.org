import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const names = (list) => [...list.matchAll(/'([^']+)'/g)].map(([, name]) => name)

test("Drupal's preview target offers the frontend's preview layouts, in the same order", () => {
  const drupal = read('drupal/web/sites/default/settings.lagoon.php').match(
    /'layouts'\s*=>\s*\[([^\]]*)\]/
  )
  const nuxt = read('nuxt/nuxt.config.js').match(
    /nodePreview:\s*\{[\s\S]*?\blayouts:\s*\[([^\]]*)\]/
  )
  assert.ok(drupal, 'settings.lagoon.php lists the target layouts')
  assert.ok(nuxt, 'nuxt.config.js lists druxt.nodePreview.layouts')
  assert.deepEqual(names(drupal[1]), names(nuxt[1]))
  // A preview opens on the first layout its target lists.
  assert.equal(names(drupal[1])[0], 'preview')
})
