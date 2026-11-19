/**
 * The front page's Canvas page: where Drupal keeps it, and whether this site
 * can draw it.
 */

/** The Drupal path of the front page's Canvas page. The site answers it at `/`. */
export const FRONT_PATH = '/home'

/** How the content API's tree names one of the site's own components. */
const OWN_ELEMENT = 'js-'

/** How Canvas names one in a page's component list. */
const OWN = 'js.'

const children = (node) =>
  Object.values((node && node.slots) || {}).flatMap((slot) => (Array.isArray(slot) ? slot : [slot]))

/**
 * Whether a content API tree holds any of the site's own components.
 *
 * Such a page is drawn from the tree: the renderer draws the site's
 * components, and what Drupal rendered in the same tree as Drupal's markup.
 * A page with none is Drupal's alone, which the JSON:API rendering draws.
 *
 * @param {object|null} tree - A page's `content`.
 * @returns {boolean} True when any element of the tree is the site's own.
 */
export const hasOwnComponents = (tree) => {
  const walk = (node) =>
    Boolean(node) &&
    typeof node === 'object' &&
    (String(node.element || '').startsWith(OWN_ELEMENT) || children(node).some(walk))
  return walk(tree)
}

/**
 * Whether a JSON:API Canvas page holds any of the site's own components,
 * which only the content API's tree can draw. The same question as
 * hasOwnComponents(), asked of the other representation of a page.
 *
 * @param {object|null} resource - A `canvas_page` resource object.
 * @returns {boolean} True when a component of the page is the site's own.
 */
export const usesOwnComponents = (resource) =>
  ((((resource || {}).attributes || {}).components) || []).some(({ component_id: id }) => String(id || '').startsWith(OWN))
