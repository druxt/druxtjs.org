// The authored pages come from Drupal through the router: what the page
// component reads from the answer, and when a request's spelling differs
// from the alias.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { readdirSync } from 'node:fs'

const { PARAGRAPH_TYPES, fetchDrupalPage, pageQuery, sectionOf } = await import(
  '../nuxt/lib/drupal-document.js'
)

// The generated display schemas: a field or two per display, a bare layout section.
const SCHEMAS = {
  'node--doc_page--full--view': ['field_description', 'field_content'],
  'media--image--default--view': ['field_media_image'],
  'paragraph--docs_layout_section--default--view': [],
}
const schema = {
  import: async (name) => ({
    fields: (SCHEMAS[name] || [name.split('--')[1].replace('docs_', 'field_')]).map((id) => ({
      id,
    })),
  }),
}

// The router store's answer: the route, and where it sends the request instead.
const store = (route, redirect, resource, calls = []) => ({
  $druxtSchema: schema,
  dispatch: async (action, payload) => {
    calls.push({ action, payload })
    return action === 'druxtRouter/get' ? { route, redirect } : resource
  },
})
const page = { entity: { type: 'node', bundle: 'doc_page', uuid: 'u-1' } }
const node = {
  data: {
    attributes: { title: 'Getting started', field_description: 'Start here.', field_toc: [] },
  },
}

describe('fetchDrupalPage', () => {
  test('reads the page, with no redirect when the path is the alias', async () => {
    const doc = await fetchDrupalPage(store(page, false, node), '/tutorials/getting-started')
    assert.equal(doc.path, '/tutorials/getting-started')
    assert.equal(doc.redirect, null)
    assert.equal(doc.type, 'node--doc_page')
    assert.equal(doc.title, 'Getting started')
    assert.equal(doc.description, 'Start here.')
  })

  test('carries the redirect the router gives for another spelling of the alias', async () => {
    const doc = await fetchDrupalPage(
      store(page, '/tutorials/getting-started', node),
      '/Tutorials/Getting-Started'
    )
    assert.equal(doc.redirect, '/tutorials/getting-started')
  })

  test('asks for the page with its body included, each type trimmed to its display', async () => {
    const calls = []
    await fetchDrupalPage(store(page, false, node, calls), '/tutorials/getting-started')
    const { payload } = calls.find((call) => call.action === 'druxt/getResource')
    const { include, fields } = payload.query
    assert.equal(payload.type, 'node--doc_page')
    assert.equal(payload.id, 'u-1')
    assert.equal(
      include,
      'field_content,field_content.field_media,field_content.field_media.field_media_image'
    )
    // What the page reads itself, then what its display renders.
    assert.equal(fields['node--doc_page'], 'title,field_toc,field_description,field_content')
    assert.equal(fields['paragraph--docs_text'], 'behavior_settings,field_text')
    assert.equal(fields['paragraph--docs_layout_section'], 'behavior_settings')
    assert.equal(fields['media--image'], 'name,field_media_image')
    // The file is read whole: its wrapper asks for it without a field list.
    assert.equal(fields['file--file'], undefined)
  })

  test('is null for anything that is not a node', async () => {
    assert.equal(await fetchDrupalPage(store({ error: true }), '/nope'), null)
    assert.equal(
      await fetchDrupalPage(store({ entity: { type: 'taxonomy_term' } }), '/tags/x'),
      null
    )
  })
})

describe('PARAGRAPH_TYPES', () => {
  test('names every paragraph type this site has a view wrapper for', () => {
    const wrappers = readdirSync(
      new URL('../nuxt/components/druxt/entity/paragraph/', import.meta.url)
    )
      .filter((name) => name.endsWith('DefaultView.vue'))
      .map((name) =>
        name
          .replace('DefaultView.vue', '')
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .toLowerCase()
      )
    assert.ok(wrappers.length >= 5, `found ${wrappers.length} wrappers`)
    for (const bundle of wrappers)
      assert.ok(PARAGRAPH_TYPES.includes(bundle), `${bundle} is missing from PARAGRAPH_TYPES`)
  })

  test('pageQuery asks the schema plugin for each type once, by its display', async () => {
    const asked = []
    await pageQuery({
      import: async (name) => {
        asked.push(name)
        return { fields: [] }
      },
    })
    assert.ok(asked.includes('node--doc_page--full--view'))
    assert.ok(asked.includes('paragraph--docs_code--default--view'))
    assert.equal(new Set(asked).size, asked.length)
  })
})

describe('sectionOf', () => {
  test('is the first segment', () => {
    assert.equal(sectionOf('/how-to/proxy'), 'how-to')
    assert.equal(sectionOf('/'), '')
  })
})
