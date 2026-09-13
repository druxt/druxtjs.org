// The per-backend runtime's two pieces of judgement: which schema an id
// gets when the backend's displays fall short, and where a backend's file
// URLs go.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

const { rerouteFiles, schemaImporter } = await import('../nuxt/utils/runtime-rules.js')

// A builder whose displays are the keys of `have`, as the real one's getSchema would answer.
const builder = (have) => ({
  druxt: { getIndex: async () => ({ 'node--recipe': { href: '/jsonapi/node/recipe' } }) },
  getSchema: async ({ entityType, bundle, mode, schemaType }) => {
    const id = [entityType, bundle, mode, schemaType].join('--')
    // The real builder returns its Schema object even with no display; `.schema` is then undefined.
    return { id, schema: have[id] }
  },
})

describe('schemaImporter', () => {
  test('returns the schema a display gives', async () => {
    const importer = schemaImporter(
      builder({
        'node--recipe--full--view': { id: 'node--recipe--full--view', fields: [{ id: 'title' }] },
      })
    )
    assert.deepEqual(await importer('node--recipe--full--view'), {
      id: 'node--recipe--full--view',
      fields: [{ id: 'title' }],
    })
  })

  test('falls back to the default mode when the mode has no display', async () => {
    const importer = schemaImporter(
      builder({ 'node--recipe--default--view': { id: 'node--recipe--default--view', fields: [] } })
    )
    assert.equal((await importer('node--recipe--teaser--view')).id, 'node--recipe--default--view')
  })

  test('gives a bundle with no display at all an empty schema rather than nothing', async () => {
    const schema = await schemaImporter(builder({}))('file--file--default--view')
    assert.deepEqual(schema, {
      id: 'file--file--default--view',
      resourceType: 'file--file',
      config: {
        entityType: 'file',
        bundle: 'file',
        mode: 'default',
        schemaType: 'view',
        filter: [],
      },
      fields: [],
    })
  })

  test('treats a builder that throws the same as one that finds nothing', async () => {
    const throwing = {
      druxt: builder({}).druxt,
      getSchema: async () => {
        throw new Error('403')
      },
    }
    assert.equal((await schemaImporter(throwing)('node--page--full--view')).fields.length, 0)
  })
})

describe('rerouteFiles', () => {
  test('prefixes relative file URLs in data and included with the proxy root, and nothing else', () => {
    const response = {
      data: {
        data: [{ type: 'file--file', attributes: { uri: { url: '/sites/default/files/a.jpg' } } }],
        included: [
          { type: 'file--file', attributes: { uri: { url: 'https://cdn.example/b.jpg' } } },
          { type: 'media--image', attributes: { uri: { url: '/not-a-file' } } },
        ],
      },
    }
    rerouteFiles('/umami')(response)
    assert.equal(response.data.data[0].attributes.uri.url, '/umami/sites/default/files/a.jpg')
    assert.equal(response.data.included[0].attributes.uri.url, 'https://cdn.example/b.jpg')
    assert.equal(response.data.included[1].attributes.uri.url, '/not-a-file')
  })

  test('leaves a response without a body alone', () => {
    assert.deepEqual(rerouteFiles('/umami')({}), {})
  })
})
