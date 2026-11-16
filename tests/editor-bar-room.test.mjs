// The room a page keeps for the editor's bar: in the site footer, never in the
// page's content.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (file) => readFileSync(new URL(`../nuxt/${file}`, import.meta.url), 'utf8')

describe("the editor bar's room", () => {
  const css = read('assets/css/app.css')

  test('is kept by the site footer', () => {
    assert.match(css, /body\.has-editor-bar \.site-footer \{\s*padding-bottom: 4\.5rem;/)
    assert.match(read('components/app/SiteFooter.vue'), /<footer class="site-footer /)
  })

  test('is not kept by the page content, where it shows as a band above the footer', () => {
    assert.doesNotMatch(css, /body\.has-editor-bar main\b/)
  })
})
