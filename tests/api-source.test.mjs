// The source link on a generated API page, which is rebuilt from the content
// path because docgen writes no source path into the page.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const { apiSourceUrl } = await import('../nuxt/utils/api-source.js')

const REF = 'e7bddfe32f5c00083a4eb650f1106414279442d3'
const REPO = `https://github.com/druxt/druxt.js/blob/${REF}/packages`

describe('apiSourceUrl', () => {
  test('points a component at its .vue file, under src/', () => {
    assert.equal(
      apiSourceUrl('/api/packages/entity/components', 'DruxtField', REF),
      `${REPO}/entity/src/components/DruxtField.vue`
    )
  })

  test('keeps a nested component directory', () => {
    assert.equal(
      apiSourceUrl('/api/packages/entity/components/fields', 'DruxtFieldImage', REF),
      `${REPO}/entity/src/components/fields/DruxtFieldImage.vue`
    )
  })

  test('uses .js for every bucket that is not components', () => {
    for (const [dir, slug, expected] of [
      ['/api/packages/druxt/stores', 'druxt', 'druxt/src/stores/druxt.js'],
      ['/api/packages/entity/mixins', 'field', 'entity/src/mixins/field.js'],
      ['/api/packages/menu/typedefs', 'menuOptions', 'menu/src/typedefs/menuOptions.js'],
      ['/api/packages/schema/utils', 'schema', 'schema/src/utils/schema.js'],
      ['/api/packages/druxt/nuxt', 'index', 'druxt/src/nuxt/index.js'],
    ]) {
      assert.equal(apiSourceUrl(dir, slug, REF), `${REPO}/${expected}`, slug)
    }
  })

  test('handles the files that sit directly in src/', () => {
    for (const [slug, expected] of [
      ['index', 'entity/src/index.js'],
      ['nuxtModule', 'entity/src/nuxtModule.js'],
    ]) {
      assert.equal(apiSourceUrl('/api/packages/entity', slug, REF), `${REPO}/${expected}`, slug)
    }
  })

  test('puts the changelog beside src/, not inside it', () => {
    assert.equal(
      apiSourceUrl('/api/packages/entity', 'CHANGELOG', REF),
      `${REPO}/entity/CHANGELOG.md`
    )
  })

  test('points a directory index page at the directory, which has no file of its own', () => {
    assert.equal(
      apiSourceUrl('/api/packages/router/components', 'index', REF),
      `https://github.com/druxt/druxt.js/tree/${REF}/packages/router/src/components`
    )
  })

  test('has no link for a page outside the packages tree', () => {
    assert.equal(apiSourceUrl('/api', 'README', REF), null)
    assert.equal(apiSourceUrl('', 'README', REF), null)
    assert.equal(apiSourceUrl('/api/packages/entity', '', REF), null)
  })
})

describe('apiSourceUrl without a ref', () => {
  test('links at HEAD, which GitHub resolves to the default branch', () => {
    assert.equal(
      apiSourceUrl('/api/packages/entity', 'CHANGELOG'),
      'https://github.com/druxt/druxt.js/blob/HEAD/packages/entity/CHANGELOG.md'
    )
  })
})
