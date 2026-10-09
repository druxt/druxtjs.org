const { previewRoute } = require('../lib/node-preview')

/**
 * Puts this site's page on the preview module's route.
 *
 * A module's extendRoutes is chained after the ones before it, and after
 * nuxt.config's own, so this runs once the preview module has added its
 * route and swaps the component for the site's: the entity inside the page
 * header and prose shell a saved page gets. Listed after the preview module.
 */
module.exports = function nodePreviewPage() {
  this.extendRoutes((routes) => previewRoute(routes, '~/components/app/NodePreviewPage.vue'))
}
