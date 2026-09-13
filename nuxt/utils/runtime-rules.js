/**
 * The per-backend runtime's two pieces of judgement, on their own so they
 * can be tested without the Druxt packages: which schema an id gets when
 * the backend's displays fall short, and where a backend's file URLs go.
 */

/**
 * The response interceptor that points a backend's file URLs at its proxy
 * root: a file entity names its URL on the backend's own origin.
 *
 * @param {string} proxyRoot - Where the backend is served on this origin.
 */
export const rerouteFiles = (proxyRoot) => (response) => {
  const body = (response || {}).data || {}
  for (const o of [].concat(body.data || [], body.included || [])) {
    const url = (((o || {}).attributes || {}).uri || {}).url
    if (o.type === 'file--file' && typeof url === 'string' && url.startsWith('/')) o.attributes.uri.url = proxyRoot + url
  }
  return response
}

/**
 * A schema importer, the `$druxtSchema.import` a site's plugin provides,
 * building each schema from the backend's own displays instead of a file.
 *
 * The default mode stands in for a missing one, and a bundle with no
 * display at all, such as a file, gets an empty schema, so a slot can still
 * render its entity. The builder returns its Schema object even when it
 * found no display, so what counts is the `.schema` it carries.
 *
 * @param {DruxtSchema} builder - A schema builder with a client for the backend.
 */
export const schemaImporter = (builder) => async (id) => {
  const [entityType, bundle, mode, schemaType] = id.split('--')
  const index = await builder.druxt.getIndex()
  const build = (m) => builder.getSchema({ entityType, bundle, mode: m, schemaType, filter: [], ...index[`${entityType}--${bundle}`] }).then((s) => (s && s.schema) || false, () => false)
  const schema = (await build(mode)) || (mode !== 'default' && (await build('default')))
  return schema || { id, resourceType: `${entityType}--${bundle}`, config: { entityType, bundle, mode, schemaType, filter: [] }, fields: [] }
}
