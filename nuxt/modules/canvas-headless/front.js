/**
 * The front page's Canvas page: where Drupal keeps it, and whether this site
 * can draw it.
 */

/** The Drupal path of the front page's Canvas page. The site answers it at `/`. */
export const FRONT_PATH = '/home'

/** How the content API names a component Drupal rendered for itself. */
const DRUPAL_MARKUP = 'drupal-markup'

/** The component Canvas prefixes with this is one of the site's own. */
const OWN = 'js.'

const children = (node) =>
  Object.values((node && node.slots) || {}).flatMap((slot) => (Array.isArray(slot) ? slot : [slot]))

/**
 * Whether a content API tree is made of the site's own components.
 *
 * A page built from Drupal's components arrives as Drupal's markup, which is
 * not the page a visitor should get: the JSON:API rendering draws that page.
 *
 * @param {object|null} tree - A page's `content`.
 * @returns {boolean} True when there is a tree and none of it is Drupal's markup.
 */
export const drawable = (tree) => {
  if (!tree || typeof tree !== 'object') return false
  const walk = (node) =>
    !node || typeof node !== 'object' || (node.element !== DRUPAL_MARKUP && children(node).every(walk))
  return walk(tree)
}

/**
 * Whether a JSON:API Canvas page holds any of the site's own components,
 * which only the content API's tree can draw.
 *
 * @param {object|null} resource - A `canvas_page` resource object.
 * @returns {boolean} True when a component of the page is the site's own.
 */
export const usesOwnComponents = (resource) =>
  ((((resource || {}).attributes || {}).components) || []).some(({ component_id: id }) => String(id || '').startsWith(OWN))
