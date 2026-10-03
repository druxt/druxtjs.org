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
  return {
    uuid,
    type,
    field,
    kind,
    el: anchor,
    // A code block whose field is the code says "Code", not "Code, the code".
    label: field && FIELDS[field] && FIELDS[field] !== kind.toLowerCase() ? `${kind}, the ${FIELDS[field]}` : kind,
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
 * block's Edit opens that form at the field the block lives in. Editing a
 * block on its own waits for the in-place editor.
 *
 * @param {object} subject - The subject.
 * @param {object} page - The page subject, which owns the form.
 * @param {string} href - The page's `edit-form` link.
 * @param {string} back - Where Drupal should return the reader.
 * @returns {string|null} The URL, or null where there is nothing to open.
 */
const editHref = (subject, page, href, back) => {
  if (!href) return null
  const destination = back ? `${href.includes('?') ? '&' : '?'}destination=${encodeURIComponent(back)}` : ''
  const url = `${href}${destination}`
  if (!subject || !page || subject.uuid === page.uuid) return url
  // The builder holds every block, and Drupal has no page of its own for one.
  return `${url}#edit-field-content-wrapper`
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
  const what = subject.field && FIELDS[subject.field] ? FIELDS[subject.field] : String(subject.kind || 'block').toLowerCase()
  return `Edit this page, at the ${what}`
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

module.exports = { editHref, editLabel, kindOf, pageSubject, subjectFromElement, subjectsOn }
