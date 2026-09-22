/**
 * An entity's operations, as Drupal offers them on its JSON:API resource.
 *
 * The druxtjsorg module adds one link per operation the signed-in user may
 * use: `edit-form`, `version-history` and so on, each titled. A reader is
 * sent none, so there is nothing here to hide from them.
 *
 * Plain CommonJS, so the tests import it without the app.
 */

/** The hint Drupal sets for a signed-in user. The session cookie itself is HttpOnly. */
const HINT = 'druxt_editor'

/** The operations offered, in the order they are listed. */
const OPERATIONS = ['edit-form', 'version-history', 'drupal:content-translation-overview', 'delete-form']

/**
 * Whether a signed-in user may be looking.
 *
 * @param {string} [cookies] - `document.cookie`.
 * @returns {boolean} True when the hint is set.
 */
const hasEditorHint = (cookies) => String(cookies || '').split(/;\s*/).some((pair) => pair.split('=')[0] === HINT)

/**
 * The request for the links of several entities of one type.
 *
 * An empty sparse fieldset, so only each resource's type, id and links come
 * back.
 *
 * @param {string} type - The resource type, such as `node--doc_page`.
 * @param {string[]} ids - The entities' UUIDs.
 * @returns {string} A URL on this origin.
 */
const operationsUrl = (type, ids) => {
  const params = new URLSearchParams()
  params.set('filter[ids][condition][path]', 'id')
  params.set('filter[ids][condition][operator]', 'IN')
  for (const id of ids) params.append('filter[ids][condition][value][]', id)
  params.set(`fields[${type}]`, '')
  return `/jsonapi/${type.replace('--', '/')}?${params}`
}

/**
 * A resource's operations, linking to this origin.
 *
 * Drupal builds each href on the host it was asked on. Made relative, it is
 * answered by the backend this site proxies, where the editor is signed in.
 *
 * @param {object} resource - A JSON:API resource object.
 * @returns {Array<{ key: string, title: string, href: string }>} The operations.
 */
const operationsOf = (resource) => {
  const links = (resource && resource.links) || {}
  return OPERATIONS.filter((key) => links[key] && links[key].href).map((key) => {
    const url = new URL(links[key].href, 'http://relative')
    const title = (((links[key].meta || {}).linkParams || {}).title) || key
    return { key, title, href: `${url.pathname}${url.search}` }
  })
}

module.exports = { HINT, OPERATIONS, hasEditorHint, operationsUrl, operationsOf }
