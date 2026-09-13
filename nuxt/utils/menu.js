const isExternal = (url) => /^https?:\/\//.test(url)

const toItem = ({ entity, children }) => {
  const { title, url } = entity.attributes
  return {
    component: isExternal(url) ? 'a' : 'NuxtLink',
    text: title,
    props: isExternal(url) ? { href: url, target: '_blank' } : { to: url },
    children: (children || []).map(toItem),
  }
}

/**
 * DruxtMenu's item tree, as the site menu's items.
 *
 * @param {object[]} items - DruxtMenu items, each `{ entity, children }`.
 * @returns {object[]} Menu items: `{ component, text, props, children }`.
 */
export const toMenuItems = (items) => (items || []).map(toItem)

/**
 * The sections whose children the site generates from docgen. A Drupal item
 * under one of these is a page of something listed, such as a module's
 * deprecations, not the list itself.
 */
const GENERATED = new Set(['/modules', '/components', '/api'])

/**
 * Drupal's sections, in Drupal's order, inside the site's own menu.
 *
 * Home, and the generated sections Drupal holds no content for (the API
 * reference and components, from docgen), stay where the site puts them. A
 * Drupal section keeps its icon, and the site's generated children when
 * Drupal has none of its own; a generated section keeps them regardless.
 *
 * @param {object[]} items - DruxtMenu items for the docs menu.
 * @param {object[]} site - The site menu from the store.
 * @returns {object[]} The merged menu.
 */
export const mergeSiteMenu = (items, site) => {
  const byPath = Object.fromEntries(site.map((o) => [o.props.to || o.props.href, o]))
  const sections = toMenuItems(items).map((item) => {
    const known = byPath[item.props.to] || {}
    const generated = GENERATED.has(item.props.to) && (known.children || []).length
    return { ...item, icon: known.icon, children: generated || !item.children.length ? known.children || [] : item.children }
  })
  const covered = new Set(sections.map((o) => o.props.to))
  const home = site.filter((o) => o.icon === 'home')
  const rest = site.filter((o) => o.icon !== 'home' && !covered.has(o.props.to))
  return [...home, ...sections, ...rest]
}

/** Computed properties for a menu block wrapper: the menu its plugin names, and its depth. */
export const menuBlock = {
  menu: ({ block }) => block.attributes.plugin.split(':')[1],
  depth: ({ block }) => (block.attributes.settings || {}).depth || undefined,
}
