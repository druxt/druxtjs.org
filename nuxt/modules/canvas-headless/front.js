/**
 * The front page's Canvas page: where Drupal keeps it, and whether this site
 * can draw it.
 */
import { hasOwn } from './tree.js'

/** The Drupal path of the front page's Canvas page. The site answers it at `/`. */
export const FRONT_PATH = '/home'

/** How Canvas names one of the site's own components in a page's list. */
const OWN = 'js.'

/**
 * Whether a content API document holds any of the site's own components.
 *
 * Such a page is drawn from the document: the renderer draws the site's
 * components, and what Drupal rendered in the same document as Drupal's
 * markup. A page with none is Drupal's alone, which the JSON:API rendering
 * draws.
 *
 * @param {object|null} tree - A page's `content`, a json-render document.
 * @returns {boolean} True when any element of the document is the site's own.
 */
export const hasOwnComponents = (tree) => hasOwn(tree)

/**
 * Whether a page is drawn from the content API's tree, with Canvas Headless on.
 *
 * In a draft session it always is: only the tree is the editor's draft, and
 * only its elements can be selected in the editor. A page of Drupal's
 * components is then Drupal's markup, without the site's styles. Outside a
 * session, a page is drawn from the tree when it holds any of the site's own.
 *
 * @param {object|null} page - The page as the content API answered.
 * @param {object} [session] - The request's draft session state.
 * @returns {boolean} True when the tree draws the page.
 */
export const drawnFromTree = (page, session) =>
  Boolean(page && page.content) && (Boolean(session && session.enabled) || hasOwnComponents(page.content))

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
