/**
 * Helpers for working with @nuxt/content v1 document bodies (a JSON AST).
 */

const isElement = (node, tag) => node && node.type === 'element' && node.tag === tag

/**
 * Depth-first search for the first <img>, returning it and its parent.
 *
 * @param {object} node - The AST node to search from.
 * @param {?object} parent - The node's parent, carried through the descent.
 * @returns {?object} The image and its parent, as { node, parent }.
 */
const findImage = (node, parent) => {
  // Linked images are badges, never the hero screenshot.
  if (isElement(node, 'a')) return null
  if (isElement(node, 'img')) return { node, parent }
  const children = (node && node.children) || []
  for (const child of children) {
    const found = findImage(child, node)
    if (found) return found
  }
  return null
}

/**
 * Pull a module README's opening screenshot out of the body, so the page can
 * render it as a hero figure.
 *
 * `body` comes back as a copy with the image, and any paragraph that only
 * wrapped it, removed.
 *
 * @param {object} document - The content document.
 * @returns {object} The hero image and remaining body, as { hero, body }.
 */
export const extractHero = (document) => {
  const body = document && document.body
  if (!body) return { hero: null, body }

  const found = findImage(body, null)
  if (!found) return { hero: null, body }

  const { node, parent } = found
  const hero = {
    src: node.props.src,
    alt: node.props.alt || '',
  }

  // Only treat it as the hero if it leads the document.
  const first = (body.children || []).find((o) => o.type === 'element')
  const leads = first && (first === parent || first === node
    || (first.children || []).includes(node))
  if (!leads) return { hero: null, body }

  const strip = (n) => ({
    ...n,
    children: (n.children || [])
      .filter((child) => child !== node)
      // Drop the paragraph that only wrapped the hero image, keeping one that
      // carries its own content. Text nodes count: a caption is one.
      .filter((child) => !(
        isElement(child, 'p')
        && (child.children || []).includes(node)
        && !(child.children || []).some((o) => o !== node && (
          (o.type === 'element' && o.tag !== 'img')
          || (o.type === 'text' && (o.value || '').trim())
        ))
      ))
      .map((child) => (child.children ? strip(child) : child)),
  })

  return { hero, body: strip(body) }
}

/**
 * Plain text of a node and everything under it.
 *
 * @param {?object} node - The AST node.
 * @returns {string} The concatenated text content.
 */
const textOf = (node) => {
  if (!node) return ''
  if (node.type === 'text') return node.value || ''
  return (node.children || []).map(textOf).join('')
}

/**
 * A one-line summary of a document, for `<meta name="description">`.
 *
 * Almost nothing in `content/` sets a frontmatter description, so the first
 * paragraph stands in. lib/content-index.js `excerpt()` does the same job at
 * build time from raw Markdown; keep the skip rules in step.
 *
 * @param {object} document - A @nuxt/content document.
 * @returns {string} A plain-text summary, or an empty string.
 */
export const documentDescription = (document) => {
  if (document && document.description) return document.description

  const children = ((document || {}).body || {}).children || []

  for (const node of children) {
    if (node.type !== 'element') continue
    if (node.tag !== 'p' && node.tag !== 'blockquote') continue

    const text = textOf(node).replace(/\s+/g, ' ').trim()
    if (!text) continue
    // A note to a maintainer, not a summary.
    if (/^(TODO|FIXME|NOTE|XXX)\b[:\s]/i.test(text)) continue

    return text
  }

  return ''
}

/**
 * Sections a module README declares, used to build the in-page nav.
 *
 * @param {object} document - The content document.
 * @returns {object[]} Depth-2 headings as { id, text }.
 */
export const sections = (document) => (document.toc || [])
  .filter((o) => o.depth === 2)
  .map((o) => ({ id: o.id, text: o.text }))

/**
 * Where a document sits, for disambiguating a bare title.
 *
 * Documents can share a title, so this returns the path segments above the
 * leaf, title-cased and capped at the last two:
 *
 *   /modules/entity/deprecations -> 'Modules / Entity'
 *   /guide/theming               -> 'Guide'
 *   /api/packages/druxt/client   -> 'Packages / Druxt'
 *
 * Returns '' for a top-level path.
 *
 * @param {string} path - The document's route path.
 * @returns {string} A short human-readable location, or an empty string.
 */
export const documentContext = (path) => (path || '')
  .split('/')
  .filter(Boolean)
  .slice(0, -1)
  .slice(-2)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '))
  .join(' / ')
