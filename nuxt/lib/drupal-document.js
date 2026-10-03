/** The first path segment, which is the documentation section. */
export const sectionOf = (path) => path.split('/').filter(Boolean)[0] || ''

/** The paragraph types a documentation page is built from. */
export const PARAGRAPH_TYPES = ['docs_callout', 'docs_code', 'docs_diagram', 'docs_image', 'docs_layout_section', 'docs_rich_text', 'docs_text']

/** Everything the page's body renders, fetched with the page in one request. */
const INCLUDE = ['field_content', 'field_content.field_media', 'field_content.field_media.field_media_image']

/** What this module reads from the page itself, beyond its display. */
const PAGE_FIELDS = ['title', 'field_toc', 'moderation_state', 'drupal_internal__nid']

/** What Layout Paragraphs reads from every paragraph, whatever its display. */
const PARAGRAPH_FIELDS = ['behavior_settings']

/** The fields a display renders, from its generated schema. */
const displayFields = async (schema, type, mode) => {
  const { fields = [] } = await schema.import(`${type}--${mode}--view`)
  return fields.map((field) => field.id)
}

/**
 * The page request: the body's paragraphs, media and files included, and
 * each type trimmed to what its display renders. Druxt's own requests ask
 * for the same fields (`druxt.entity.query.schema` in nuxt.config.js), so
 * they find the page's resources complete in the store.
 *
 * A versioned view (a draft or an older revision) is requested whole, and
 * without its includes: a JSON:API include always returns the default revision, so a
 * paragraph changed in that revision would come back published. Left out,
 * each paragraph is fetched on its own at the revision the node names, by the
 * page's body.
 *
 * A query object, the form the Druxt store takes, rather than the query
 * builder: the root tests import this file without the app's packages.
 *
 * @param {object} schema - The `$druxtSchema` plugin.
 * @param {object} [options] - Options.
 * @param {boolean} [options.versioned] - Whether the page is read at a non-published revision.
 * @returns {Promise<{ include?: string, fields: Object<string, string> }>} The query.
 */
export const pageQuery = async (schema, { versioned = false } = {}) => {
  const fields = {
    'media--image': ['name', ...(await displayFields(schema, 'media--image', 'default'))].join(','),
  }
  // A versioned view asks for the whole page rather than the fields it
  // renders. The Druxt store answers a sparse request from the copy it holds
  // and asks Drupal only for the fields it is missing, which for a page it
  // already has is none: it then sends `fields[node--doc_page]=undefined`,
  // Drupal answers 400, the store swallows it and returns the copy it had,
  // which is the revision the reader just left.
  if (!versioned) {
    fields['node--doc_page'] = [...PAGE_FIELDS, ...(await displayFields(schema, 'node--doc_page', 'full'))].join(',')
  }
  for (const bundle of PARAGRAPH_TYPES) {
    const type = `paragraph--${bundle}`
    fields[type] = [...PARAGRAPH_FIELDS, ...(await displayFields(schema, type, 'default'))].join(',')
  }
  return versioned ? { fields } : { include: INCLUDE.join(','), fields }
}

/**
 * Drops a revision selection that belongs to the page being left.
 *
 * `id:<vid>` names a revision of one node, and the selection is one value for
 * the whole app. Carried to the next page it asks for a revision that page does
 * not have, and the page fails to load. `published` and `working-copy` name a
 * view every page has, so they are kept. The history goes either way: it is the
 * previous page's.
 *
 * @param {object} store - The Vuex store.
 * @param {string} uuid - The page being read.
 */
const leaveRevisionBehind = (store, uuid) => {
  const { page, version } = store.state.editor
  if (!page || page.uuid === uuid) return
  if (/^id:/.test(String(version))) store.commit('setEditorVersion', 'working-copy')
  store.commit('setEditorRevisions', [])
}

/**
 * Resolves a path through the Druxt router, and loads the page it names.
 *
 * Only what the page header, table of contents and footer need is read from
 * it here. The body renders through DruxtEntity. Its paragraphs, media and
 * files come in the same request, and the Druxt store keeps each included
 * resource, so every nested DruxtEntity finds its data already loaded.
 *
 * @param {object} store - The Vuex store with the Druxt modules.
 * @param {string} path - The route path.
 * @returns {Promise<object|null>} The page, or null when no page has the path.
 */
export const fetchDrupalPage = async (store, path) => {
  const { route, redirect } = (await store.dispatch('druxtRouter/get', path)) || {}
  const entity = route && !route.error && route.entity
  if (!entity || entity.type !== 'node') return null

  const type = `node--${entity.bundle}`
  // A signed-in editor reads the page at the toolbar's selected version, and
  // never from the store's cache, so switching version always re-fetches.
  // See plugins/working-copy.js and the editor store state.
  const editor = Boolean(store.$auth && store.$auth.loggedIn)
  if (editor) leaveRevisionBehind(store, entity.uuid)
  const versioned = editor && store.state.editor.version !== 'published'
  const read = async (wanted) => {
    const query = await pageQuery(store.$druxtSchema, { versioned: wanted })
    const resource = await store.dispatch('druxt/getResource', { type, id: entity.uuid, query, bypassCache: editor })
    return resource && (resource.data || resource)
  }

  let data = await read(versioned)
  // Drupal refuses a revision this account may not read, and the Druxt store
  // returns that as an empty resource. The published page is the one every
  // reader may see, so it is shown instead of an error, and the toolbar is put
  // back to the version being shown.
  if (versioned && (!data || !data.attributes)) {
    store.commit('setEditorVersion', 'published')
    data = await read(false)
  }
  if (!data || !data.attributes) throw new Error(`Drupal returned no ${type} for ${path}`)

  // What the editor toolbar needs to name and switch this page's revisions.
  if (editor) {
    store.commit('setEditorPage', {
      uuid: entity.uuid,
      nid: data.attributes.drupal_internal__nid || null,
      moderationState: data.attributes.moderation_state || null,
    })
  }

  return {
    path,
    // Where the router sends this request instead: Drupal's redirect for it,
    // or its alias when the path only differs from the alias in case.
    redirect: redirect || null,
    type,
    uuid: entity.uuid,
    title: data.attributes.title,
    description: data.attributes.field_description || '',
    toc: data.attributes.field_toc || [],
    moderationState: data.attributes.moderation_state || null,
  }
}
