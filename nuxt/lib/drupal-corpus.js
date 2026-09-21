/**
 * The authored documentation, read from Drupal, in the shape
 * `content-index.js` produces for the generated pages.
 *
 * The database is the source of truth for the authored pages, but the
 * machine-readable indexes were built from a markdown corpus baked into the
 * image at its pinned commit. A page authored in Drupal was therefore served
 * to readers and absent from `sitemap.xml` and `llms.txt` until the pin
 * moved. This reads the same pages the site renders.
 *
 * The generated reference pages (`api/`, `components/`, and the module
 * READMEs) have no Drupal representation by design, so they keep coming from
 * the image and the two are merged.
 *
 * Deliberately plain CommonJS with no Druxt packages: the production server
 * loads this before the Nuxt app exists, and the tests import it without the
 * app's dependencies.
 */

const { getJson } = require('../server/backend')

/** The paragraph bundles a page body is built from. */
const PARAGRAPH_TYPES = [
  'docs_callout',
  'docs_code',
  'docs_diagram',
  'docs_image',
  'docs_layout_section',
  'docs_rich_text',
  'docs_text',
]

/** How many pages to ask for at a time. */
const PAGE_SIZE = 50

/** A guard against following `next` forever if a backend misbehaves. */
const MAX_REQUESTS = 50

/**
 * The collection URL: published pages, with their body paragraphs included.
 *
 * Sparse fieldsets keep this to what the indexes actually use. The body is
 * needed because `llms-full.txt` carries the whole page.
 *
 * @param {string} baseUrl - Drupal's base URL.
 * @returns {string} The absolute URL.
 */
const collectionUrl = (baseUrl) => {
  const url = new URL('/jsonapi/node/doc_page', baseUrl)
  const params = url.searchParams
  params.set('filter[status]', '1')
  params.set('sort', 'field_weight,title')
  params.set('page[limit]', String(PAGE_SIZE))
  // The media is included for an image's alt text alone, which is the only
  // part of an image that reads as text in llms-full.txt.
  params.set('include', 'field_content,field_content.field_media')
  params.set('fields[node--doc_page]', 'title,path,field_description,field_weight,field_content')
  params.set('fields[media--image]', 'field_media_image')
  params.set('fields[paragraph--docs_text]', 'field_text')
  params.set('fields[paragraph--docs_rich_text]', 'field_rich_text')
  params.set('fields[paragraph--docs_callout]', 'field_callout,field_callout_type')
  params.set('fields[paragraph--docs_code]', 'field_code,field_language')
  params.set('fields[paragraph--docs_diagram]', 'field_diagram,field_syntax')
  params.set('fields[paragraph--docs_image]', 'field_media')
  params.set('fields[paragraph--docs_layout_section]', 'behavior_settings')
  return url.href
}

/**
 * A long-text field's raw value, whatever shape JSON:API gave it.
 *
 * @param {*} field - The field value.
 * @returns {string} The raw text, or an empty string.
 */
const textValue = (field) => {
  if (typeof field === 'string') return field
  if (field && typeof field === 'object' && typeof field.value === 'string') return field.value
  return ''
}

/**
 * One paragraph as the markdown it was authored from.
 *
 * Markdown rather than the rendered HTML: the indexes have always carried
 * markdown, the authored text is stored as markdown, and reconstructing it
 * keeps a page's entry the same whether it came from Drupal or from a file.
 *
 * @param {object} paragraph - The included paragraph resource.
 * @returns {string} The markdown, or an empty string for a structural paragraph.
 */
const paragraphMarkdown = (paragraph, byId = new Map()) => {
  const type = String(paragraph.type || '').replace(/^paragraph--/, '')
  const attributes = paragraph.attributes || {}

  switch (type) {
    case 'docs_text':
      return textValue(attributes.field_text)

    case 'docs_rich_text':
      return textValue(attributes.field_rich_text)

    // Already authored as a blockquote, so it carries its own marker.
    case 'docs_callout':
      return textValue(attributes.field_callout)

    case 'docs_code': {
      const code = textValue(attributes.field_code)
      if (!code) return ''
      return '```' + (attributes.field_language || '') + '\n' + code + '\n```'
    }

    case 'docs_diagram': {
      const source = textValue(attributes.field_diagram)
      if (!source) return ''
      return '```' + (attributes.field_syntax || '') + '\n' + source + '\n```'
    }

    // The alt text is the only part of an image that reads as text. It sits
    // on the media's own image relationship, not on the paragraph.
    case 'docs_image': {
      const reference = ((paragraph.relationships || {}).field_media || {}).data
      const media = reference && byId.get(`${reference.type}:${reference.id}`)
      const image = media && ((media.relationships || {}).field_media_image || {}).data
      const alt = image && image.meta && image.meta.alt
      return alt ? `![${alt}]()` : ''
    }

    // A section is a layout, not content. Its children are listed beside it.
    case 'docs_layout_section':
      return ''

    default:
      return ''
  }
}

/**
 * Index the included resources by type and id, for relationship lookups.
 *
 * @param {Array<object>} included - A JSON:API document's `included`.
 * @returns {Map<string, object>} Resources keyed `type:id`.
 */
const indexIncluded = (included) => {
  const byId = new Map()
  for (const resource of included || []) {
    if (resource && resource.type && resource.id) byId.set(`${resource.type}:${resource.id}`, resource)
  }
  return byId
}

/**
 * A page's body, as the markdown its paragraphs were authored from.
 *
 * @param {object} page - The node resource.
 * @param {Map<string, object>} byId - The included resources.
 * @returns {string} The body markdown.
 */
const bodyOf = (page, byId) => {
  const references = ((page.relationships || {}).field_content || {}).data || []
  return references
    .map((reference) => byId.get(`${reference.type}:${reference.id}`))
    .filter(Boolean)
    .map((paragraph) => paragraphMarkdown(paragraph, byId))
    .filter((markdown) => markdown !== '')
    .join('\n\n')
}

/**
 * One page as an index document.
 *
 * @param {object} page - The node resource.
 * @param {Map<string, object>} byId - The included resources.
 * @returns {object|null} The document, or null without a usable alias.
 */
const documentOf = (page, byId) => {
  const attributes = page.attributes || {}
  const alias = attributes.path && attributes.path.alias
  if (typeof alias !== 'string' || !alias.startsWith('/')) return null

  return {
    route: alias,
    title: attributes.title || '',
    description: attributes.field_description || '',
    weight: typeof attributes.field_weight === 'number' ? attributes.field_weight : 0,
    section: alias.split('/').filter(Boolean)[0] || null,
    content: bodyOf(page, byId),
  }
}

/**
 * Every published documentation page Drupal holds.
 *
 * Throws when any page of results cannot be read. Returning what it managed
 * to collect would be worse than failing: the caller caches the result as a
 * good one, so a moment of Drupal being unreachable would publish a sitemap
 * with the authored pages missing, and hold it for the time to live. A
 * crawler reads that as those pages having been removed. Failing instead
 * leaves the previous answer standing, which is the whole point of holding
 * one.
 *
 * @param {string} baseUrl - Drupal's base URL.
 * @param {object} [options] - Options.
 * @param {Function} [options.fetch] - The JSON getter, for tests.
 * @param {Function} [options.log] - Logs a line.
 * @throws {Error} When Drupal cannot be read, or answers something unusable.
 * @returns {Promise<Array<object>>} The documents.
 */
const fetchDrupalDocs = async (baseUrl, { fetch = getJson, log = () => {} } = {}) => {
  const documents = []
  let next = collectionUrl(baseUrl)
  let requests = 0

  while (next && requests < MAX_REQUESTS) {
    requests += 1
    const body = await fetch(next)
    if (!body || !Array.isArray(body.data)) {
      log(`drupal corpus: no usable answer from ${next}`)
      throw new Error(`Drupal did not answer with a page of documents: ${next}`)
    }

    const byId = indexIncluded(body.included)
    for (const page of body.data) {
      const document = documentOf(page, byId)
      if (document) documents.push(document)
    }

    const link = (body.links || {}).next
    next = link && typeof link.href === 'string' ? link.href : null
  }

  return documents
}

/**
 * The authored pages and the generated ones as one corpus.
 *
 * A route in both belongs to Drupal: the module pages exist as authored
 * pages and as generated READMEs, and what the site serves is the authored
 * one, so that is what the indexes describe.
 *
 * @param {Array<object>} drupalDocs - Documents from Drupal.
 * @param {Array<object>} generatedDocs - Documents from the content tree.
 * @returns {Array<object>} The merged corpus, sorted by route.
 */
const mergeCorpus = (drupalDocs, generatedDocs) => {
  const byRoute = new Map()
  for (const doc of generatedDocs || []) byRoute.set(doc.route, doc)
  for (const doc of drupalDocs || []) byRoute.set(doc.route, doc)
  return [...byRoute.values()].sort((a, b) => a.route.localeCompare(b.route))
}

module.exports = {
  PARAGRAPH_TYPES,
  collectionUrl,
  fetchDrupalDocs,
  mergeCorpus,
  paragraphMarkdown,
}
