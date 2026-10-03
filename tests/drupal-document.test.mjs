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
    assert.equal(
      fields['node--doc_page'],
      'title,field_toc,moderation_state,drupal_internal__nid,field_description,field_content'
    )
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

// A revision id names a revision of one node. The selection is one value for
// the whole app, so carrying `id:52` from the page it was chosen on to the next
// page asked Drupal for a revision that page does not have, and every page
// after it failed to load until the editor changed the selection back.
describe('fetchDrupalPage, signed in, moving between pages', () => {
  /** A store for a signed-in editor, carrying the editor state and its commits. */
  const editorStore = (uuid, editor, calls = []) => ({
    $druxtSchema: schema,
    $auth: { loggedIn: true },
    state: { editor },
    commit: (name, payload) => {
      calls.push({ commit: name, payload })
      if (name === 'setEditorVersion') editor.version = payload || 'published'
      if (name === 'setEditorPage') editor.page = payload || null
      if (name === 'setEditorRevisions') editor.revisions = payload || []
    },
    dispatch: async (action, payload) => {
      calls.push({ action, payload })
      return action === 'druxtRouter/get'
        ? { route: { entity: { type: 'node', bundle: 'doc_page', uuid } }, redirect: false }
        : node
    },
  })

  test('a revision id chosen on another page is dropped', async () => {
    const calls = []
    const editor = { version: 'id:52', revisions: [{ vid: 52 }], page: { uuid: 'u-1' } }
    await fetchDrupalPage(editorStore('u-2', editor, calls), '/how-to/other')

    assert.equal(editor.version, 'working-copy', 'back to the page-independent default')
    assert.deepEqual(editor.revisions, [], "and not the previous page's history")
    const { payload } = calls.find((call) => call.action === 'druxt/getResource')
    assert.equal(payload.query.include, undefined, 'still the versioned query shape')
  })

  test('a revision id is kept on the page it was chosen on', async () => {
    const editor = { version: 'id:52', revisions: [{ vid: 52 }], page: { uuid: 'u-1' } }
    await fetchDrupalPage(editorStore('u-1', editor), '/tutorials/getting-started')

    assert.equal(editor.version, 'id:52')
    assert.deepEqual(editor.revisions, [{ vid: 52 }])
  })

  test('a view that belongs to no single page survives the move', async () => {
    for (const version of ['working-copy', 'published']) {
      const editor = { version, revisions: [], page: { uuid: 'u-1' } }
      await fetchDrupalPage(editorStore('u-2', editor), '/how-to/other')
      assert.equal(editor.version, version)
    }
  })

  test('the first page an editor opens keeps the default view', async () => {
    const editor = { version: 'working-copy', revisions: [], page: null }
    await fetchDrupalPage(editorStore('u-1', editor), '/tutorials/getting-started')
    assert.equal(editor.version, 'working-copy')
  })

  // One store value serves every route, and only a Drupal page writes it, so
  // without the path on it the editor bar went on naming, and offering
  // operations on, the page the reader had left.
  test('the page carries the route it answers', async () => {
    const editor = { version: 'published', revisions: [], page: null }
    await fetchDrupalPage(editorStore('u-1', editor), '/tutorials/getting-started')
    assert.equal(editor.page.path, '/tutorials/getting-started')

    await fetchDrupalPage(editorStore('u-2', editor), '/how-to/other')
    assert.equal(editor.page.path, '/how-to/other', 'and it moves with the reader')
  })
})

// A contributor may read only their own unpublished work, so Drupal refuses
// the latest revision of somebody else's draft. The Druxt store turns that
// refusal into an empty resource, which read as "no such page" and sent the
// reader to the error page instead of the published page that is right there.
describe('fetchDrupalPage, when the working copy is refused', () => {
  const denied = (uuid, editor, calls = []) => ({
    $druxtSchema: schema,
    $auth: { loggedIn: true },
    state: { editor },
    commit: (name, payload) => {
      calls.push({ commit: name, payload })
      if (name === 'setEditorVersion') editor.version = payload || 'published'
    },
    dispatch: async (action, payload) => {
      calls.push({ action, payload })
      if (action === 'druxtRouter/get') {
        return { route: { entity: { type: 'node', bundle: 'doc_page', uuid } }, redirect: false }
      }
      // Denied while a version is asked for; the published default is readable.
      return payload.query.include ? node : {}
    },
  })

  test('falls back to the published page rather than failing', async () => {
    const calls = []
    const editor = { version: 'working-copy', revisions: [], page: null }
    const doc = await fetchDrupalPage(denied('u-1', editor, calls), '/tutorials/getting-started')

    assert.equal(doc.title, 'Getting started')
    assert.equal(editor.version, 'published', 'and the toolbar says which version this is')
    const fetches = calls.filter((call) => call.action === 'druxt/getResource')
    assert.equal(fetches.length, 2, 'the working copy, then the published page')
    assert.equal(
      fetches[1].payload.query.include,
      'field_content,field_content.field_media,field_content.field_media.field_media_image'
    )
  })

  test('a page that is missing outright is still an error, not a silent blank', async () => {
    const editor = { version: 'published', revisions: [], page: null }
    const store = {
      $druxtSchema: schema,
      $auth: { loggedIn: true },
      state: { editor },
      commit: () => {},
      dispatch: async (action) =>
        action === 'druxtRouter/get'
          ? { route: { entity: { type: 'node', bundle: 'doc_page', uuid: 'u-9' } } }
          : {},
    }
    await assert.rejects(() => fetchDrupalPage(store, '/gone'), /returned no node--doc_page/)
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
