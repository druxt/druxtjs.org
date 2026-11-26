import DruxtRouter from 'druxt-router/dist/components/DruxtRouter.vue'

/**
 * Answers a path a route cannot render.
 *
 * DruxtRouter's middleware, which the catch-all route runs for every path no
 * page claims, asks Drupal for the path: a redirect Drupal holds is sent with
 * Drupal's status, and anything else is the 404. A route that claims a path
 * first, such as a section or the modules, ends here when it has no page for
 * it, so the path is answered as the catch-all would answer it.
 *
 * @param {object} context - The Nuxt context of the route's asyncData.
 * @returns {Promise<void>}
 */
export const notFound = async (context) => {
  await DruxtRouter.middleware(context)
  if (!context._redirected) context.error({ statusCode: 404, message: 'Document not found' })
}
