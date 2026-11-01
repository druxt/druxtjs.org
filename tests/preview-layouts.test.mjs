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

test('the frontend registers its target on the consumer the rollout makes, where Drupal leaves its own out', () => {
  const registrar = read('drupal/web/modules/custom/druxtjsorg/src/PreviewRegistrar.php')
  const constant = (name) => registrar.match(new RegExp(`const ${name} = '([^']+)'`))?.[1]
  const nuxt = read('nuxt/nuxt.config.js').match(
    /register:\s*process\.env\.(\w+)\s*\?\s*\{[^}]*consumer:\s*'([^']+)'[^}]*\}\s*:\s*false/
  )
  const drupal = read('drupal/web/sites/default/settings.lagoon.php').match(
    /if \(\$frontend && !getenv\('(\w+)'\)\) \{\s*\$settings\['consumer_node_preview'\]/
  )
  assert.ok(nuxt, 'nuxt.config.js registers only where the secret is set')
  assert.ok(drupal, 'settings.lagoon.php sets its target only where the secret is not')
  // One variable turns registration on, leaves the settings target out, and
  // is the consumer's secret.
  assert.equal(nuxt[1], constant('SECRET_VARIABLE'))
  assert.equal(drupal[1], constant('SECRET_VARIABLE'))
  assert.equal(nuxt[2], constant('CLIENT_ID'))
})
