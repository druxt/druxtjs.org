/** The first path segment, which is the documentation section. */
export const sectionOf = (path) => path.split('/').filter(Boolean)[0] || ''

/** The paragraph types a documentation page is built from. */
export const PARAGRAPH_TYPES = ['docs_callout', 'docs_code', 'docs_diagram', 'docs_image', 'docs_layout_section', 'docs_rich_text', 'docs_text']

/** Everything the page's body renders, fetched with the page in one request. */
const INCLUDE = ['field_content', 'field_content.field_media', 'field_content.field_media.field_media_image']

/** What this module reads from the page itself, beyond its display. */
const PAGE_FIELDS = ['title', 'field_toc']

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
 * A query object, the form the Druxt store takes, rather than the query
 * builder: the root tests import this file without the app's packages.
 *
 * @param {object} schema - The `$druxtSchema` plugin.
 * @returns {Promise<{ include: string, fields: Object<string, string> }>} The query.
 */
export const pageQuery = async (schema) => {
  const fields = {
    'node--doc_page': [...PAGE_FIELDS, ...(await displayFields(schema, 'node--doc_page', 'full'))].join(','),
    'media--image': ['name', ...(await displayFields(schema, 'media--image', 'default'))].join(','),
  }
  for (const bundle of PARAGRAPH_TYPES) {
    const type = `paragraph--${bundle}`
    fields[type] = [...PARAGRAPH_FIELDS, ...(await displayFields(schema, type, 'default'))].join(',')
  }
  return { include: INCLUDE.join(','), fields }
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
  const query = await pageQuery(store.$druxtSchema)
  const resource = await store.dispatch('druxt/getResource', { type, id: entity.uuid, query })
  const data = resource && (resource.data || resource)
  if (!data || !data.attributes) throw new Error(`Drupal returned no ${type} for ${path}`)

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
  }
}
