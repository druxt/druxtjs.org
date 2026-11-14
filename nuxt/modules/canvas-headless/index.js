/**
 * Canvas Headless: Canvas's editor embeds this site and shows a draft as the
 * site renders it, and the components in components/canvas are the ones an
 * editor places.
 *
 * Canvas provides this for Nuxt 4. This is the same adapter for Nuxt 2, around
 * the framework-free core of its SDK. It is off unless CANVAS_SITE_URL names
 * the Drupal site, and the SDK needs Node 22.19 or later.
 */
const path = require('path')
const createServer = require('./server')

module.exports = function canvasHeadless() {
  if (!process.env.CANVAS_SITE_URL) return
  this.addServerMiddleware(createServer({ rootDir: this.options.rootDir }))
  this.addPlugin({ src: path.join(__dirname, 'plugin.js'), fileName: 'canvas-headless.js' })
  // A Canvas page at its own path, which is where the editor opens one.
  this.extendRoutes((routes) => {
    routes.unshift({ name: 'canvas-headless-page', path: '/page/:id', component: path.join(__dirname, 'page.vue') })
  })
}
