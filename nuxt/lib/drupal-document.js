import { DrupalJsonApiParams } from 'drupal-jsonapi-params'

/** The first path segment, which is the documentation section. */
export const sectionOf = (path) => path.split('/').filter(Boolean)[0] || ''

/** Everything the page's body renders, fetched with the page in one request. */
const INCLUDE = ['field_content', 'field_content.field_media', 'field_content.field_media.field_media_image']

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
  const { route } = (await store.dispatch('druxtRouter/get', path)) || {}
  const entity = route && !route.error && route.entity
  if (!entity || entity.type !== 'node') return null

  const type = `node--${entity.bundle}`
  const query = new DrupalJsonApiParams().addInclude(INCLUDE)
  const resource = await store.dispatch('druxt/getResource', { type, id: entity.uuid, query })
  const data = resource && (resource.data || resource)
  if (!data || !data.attributes) throw new Error(`Drupal returned no ${type} for ${path}`)

  return {
    path,
    type,
    uuid: entity.uuid,
    title: data.attributes.title,
    description: data.attributes.field_description || '',
    toc: data.attributes.field_toc || [],
  }
}
