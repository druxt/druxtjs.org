// A path no page answers goes to Druxt's router, which follows a redirect
// saved in Drupal with Drupal's status, or answers with Drupal's 404.
//
//   node --test "tests/*.test.mjs"

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test("a path no page claims goes to DruxtRouter's catch-all route", () => {
  const router = read('nuxt/nuxt.config.js').match(/druxt:\s*\{[\s\S]*?\brouter:\s*\{([^}]*)\}/)
  assert.ok(router, 'nuxt.config.js sets druxt.router')
  assert.match(router[1], /\bwildcard:\s*true\b/)
})

test('every druxt-router is the patched one, which keeps the status of a Drupal redirect', () => {
  const pkg = JSON.parse(read('nuxt/package.json'))
  const patched = /^patch:druxt-router@npm%3A[\d.]+#\.\/(patches\/druxt-router-[\d.]+\.patch)$/
  const dependency = pkg.dependencies['druxt-router'].match(patched)
  assert.ok(dependency, 'the dependency is a patch')
  assert.equal(
    pkg.resolutions['druxt-router'],
    pkg.dependencies['druxt-router'],
    'the resolution is the same patch'
  )
  const patch = `nuxt/${dependency[1]}`
  assert.ok(existsSync(new URL(`../${patch}`, import.meta.url)), `${patch} exists`)
  assert.match(
    read(patch),
    /^\+\s+redirect\(status >= 300 && status < 400 \? status : 302, result\.redirect\)$/m
  )
})

test("the routes that claim a path first answer one they cannot render as DruxtRouter's catch-all would", () => {
  for (const file of ['nuxt/components/app/SectionDocument.vue', 'nuxt/pages/modules/_.vue']) {
    assert.match(read(file), /return notFound\(context\)/, file)
  }
  assert.match(read('nuxt/lib/not-found.js'), /await DruxtRouter\.middleware\(context\)/)
})
