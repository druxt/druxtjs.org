/**
 * What the editor bar is acting on.
 *
 * A page is not one entity. A doc page is a node made of paragraphs, and a
 * listing is a view of several nodes, so the bar has a subject: the thing the
 * reader is on. The page is always the fallback, because every page has one.
 *
 * Plain CommonJS, so the tests read it without the app.
 *
 * The attribute names come from @druxt-contrib/anchors rather than being
 * written here. The diff view and the field wrappers read the same contract,
 * and a second copy of the strings is a contract that drifts.
 */

/** What Drupal calls each paragraph the site renders, for a reader. */
const KINDS = {
  'paragraph--docs_text': 'Text',
  'paragraph--docs_rich_text': 'Rich text',
  'paragraph--docs_code': 'Code',
  'paragraph--docs_callout': 'Callout',
  'paragraph--docs_image': 'Image',
  'paragraph--docs_diagram': 'Diagram',
  'paragraph--docs_table': 'Table',
}

/** What a field is called, where its machine name is not what to show. */
const { ENTITY, FIELD, TYPE } = require('./anchors')

const FIELDS = {
  field_text: 'text',
  field_rich_text: 'text',
  field_code: 'code',
  field_callout: 'text',
  field_media: 'image',
  field_diagram: 'diagram',
}

/**
 * The kind of thing a resource type is, in words.
 *
 * @param {string} type - A JSON:API resource type.
 * @returns {string} What to call it.
 */
const kindOf = (type) => {
  if (KINDS[type]) return KINDS[type]
  const [entity] = String(type || '').split('--')
  if (entity === 'paragraph') return 'Block'
  if (entity === 'node') return 'Page'
  return entity ? entity.charAt(0).toUpperCase() + entity.slice(1) : 'Item'
}

/** How long a block's excerpt may run, in characters. */
const EXCERPT = 48

/**
 * Words that tell one block from another: its heading, or how it begins.
 *
 * Every text block is "Text", so the kind alone could not tell a reader which
 * of seven they were choosing.
 *
 * @param {Element} el - The block's anchor.
 * @returns {string} The excerpt, or '' where the block has no text.
 */
const excerptOf = (el) => {
  if (!el) return ''
  const heading = el.querySelector ? el.querySelector('h1, h2, h3, h4, h5, h6') : null
  const text = String((heading || el).textContent || '').replace(/\s+/g, ' ').trim()
  if (text.length <= EXCERPT) return text
  const cut = text.slice(0, EXCERPT)
  return `${cut.slice(0, cut.lastIndexOf(' ') > EXCERPT / 2 ? cut.lastIndexOf(' ') : EXCERPT)}…`
}

/**
 * The subject an element stands for, or null where it stands for nothing.
 *
 * The anchors are the ones `@druxt-contrib/anchors` writes, which is what the
 * field wrappers already render, so a subject is whatever the page has
 * already said is an entity.
 *
 * @param {Element} el - An element, usually the one under the pointer.
 * @param {object} [options] - Options.
 * @param {Function} [options.closest] - For tests without a DOM.
 * @returns {object|null} `{ uuid, type, field, kind, label }`, or null.
 */
const subjectFromElement = (el, { closest } = {}) => {
  const find = closest || ((node, selector) => (node && node.closest ? node.closest(selector) : null))
  const anchor = find(el, `[${ENTITY}]`)
  if (!anchor || !anchor.getAttribute) return null
  const uuid = anchor.getAttribute(ENTITY)
  if (!uuid || uuid === 'false') return null
  const type = anchor.getAttribute(TYPE) || ''
  const field = anchor.getAttribute(FIELD) || null
  const kind = kindOf(type)
  // A code block whose field is the code says "Code", not "Code, the code".
  const named = field && FIELDS[field] && FIELDS[field] !== kind.toLowerCase() ? `${kind}, the ${FIELDS[field]}` : kind
  return {
    uuid,
    type,
    field,
    kind,
    el: anchor,
    label: excerptOf(anchor) || named,
  }
}

/**
 * The subject for the page itself: the node the reader is reading.
 *
 * @param {object} page - The editor store's page, `{ uuid, type, title }`.
 * @returns {object|null} The subject, or null before the page is known.
 */
const pageSubject = (page) => {
  if (!page || !page.uuid) return null
  return {
    uuid: page.uuid,
    type: page.type || 'node--doc_page',
    field: null,
    kind: 'Page',
    el: null,
    label: page.title || 'This page',
  }
}

/**
 * Where Edit goes for a subject.
 *
 * Drupal edits a paragraph inside the form of the page that holds it, so a
 * block's Edit opens that form with `?paragraph=`, and the page form's builder
 * opens that block's own dialog. Saving goes through the page, so moderation,
 * revisions and the workspace all apply.
 *
 * @param {object} subject - The subject.
 * @param {object} page - The page subject, which owns the form.
 * @param {string} href - The page's `edit-form` link.
 * @param {string} back - Where Drupal should return the reader.
 * @returns {string|null} The URL, or null where there is nothing to open.
 */
const editHref = (subject, page, href, back) => {
  if (!href) return null
  const query = []
  if (back) query.push(`destination=${encodeURIComponent(back)}`)
  const block = subject && page && subject.uuid !== page.uuid
  if (block) query.push(`paragraph=${encodeURIComponent(subject.uuid)}`)
  return query.length ? `${href}${href.includes('?') ? '&' : '?'}${query.join('&')}` : href
}

/**
 * What the Edit button promises, so a reader knows before they press it.
 *
 * @param {object} subject - The subject.
 * @param {object} page - The page subject.
 * @returns {string} The label.
 */
const editLabel = (subject, page) => {
  if (!subject || !page || subject.uuid === page.uuid) return 'Edit this page'
  return `Edit this ${String(subject.kind || 'block').toLowerCase()} block`
}

/**
 * Everything on the page a reader could act on, in the order they read it.
 *
 * The page comes first, then whatever the page anchored. A touch reader has
 * no pointer to follow, so this is what the chooser offers.
 *
 * @param {Document|Element} root - Where to look.
 * @param {object} page - The page subject.
 * @returns {object[]} The subjects.
 */
const subjectsOn = (root, page) => {
  const found = []
  // Without the elements: a list a view renders has to be plain data, and an
  // element in it would be walked by the framework's reactivity.
  if (page) found.push({ ...page, el: null })
  const nodes = root && root.querySelectorAll ? root.querySelectorAll(`[${ENTITY}]`) : []
  for (const node of nodes) {
    const subject = subjectFromElement(node, { closest: (el) => el })
    if (subject && !found.some((other) => other.uuid === subject.uuid)) found.push({ ...subject, el: null })
  }
  return found
}

module.exports = { editHref, editLabel, excerptOf, kindOf, pageSubject, subjectFromElement, subjectsOn }
