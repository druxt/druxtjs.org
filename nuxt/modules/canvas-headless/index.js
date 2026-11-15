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
  this.addLayout({ src: path.join(__dirname, 'layout.vue') }, 'canvas-headless')
  // For a page that renders one way with this on and another without.
  this.options.publicRuntimeConfig = { ...this.options.publicRuntimeConfig, canvasHeadless: true }
  // A Canvas page at its own path, which is where the editor opens one.
  this.extendRoutes((routes) => {
    routes.unshift({ name: 'canvas-headless-page', path: '/page/:id', component: path.join(__dirname, 'page.vue') })
    // The front page's Canvas page has a path of its own in Drupal, which the
    // editor opens. The front page renders it.
    routes.unshift({ path: '/home', redirect: '/' })
  })
}
