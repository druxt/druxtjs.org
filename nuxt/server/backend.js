/**
 * What the start script needs to know about Drupal and the Lagoon routes.
 */
const http = require('http')
const https = require('https')

/**
 * GET a URL and parse a 200 response's JSON body.
 *
 * @param {string} url - The URL.
 * @param {number} [timeout] - Socket timeout in milliseconds.
 * @returns {Promise<object|null>} The body, or null for any other outcome.
 */
const getJson = (url, timeout = 10000) =>
  new Promise((resolve) => {
    const target = new URL(url)
    const client = target.protocol === 'https:' ? https : http
    const req = client.get(target, { headers: { Accept: 'application/vnd.api+json' }, timeout }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null)
        try {
          resolve(JSON.parse(body))
        } catch (e) {
          resolve(null)
        }
      })
    })
    req.on('timeout', () => req.destroy())
    req.on('error', () => resolve(null))
  })

/**
 * Whether Drupal holds the imported documentation. The footer menu is the
 * importer's last migration, so its items mean the import has finished.
 *
 * @param {string} baseUrl - Drupal's base URL.
 * @returns {Promise<boolean>} True once the footer menu has items.
 */
const backendReady = async (baseUrl) => {
  const menu = await getJson(new URL('/jsonapi/menu_items/footer', baseUrl).href)
  return Boolean(menu && Array.isArray(menu.data) && menu.data.length)
}

/**
 * Wait until Drupal is ready, logging once a minute until it is.
 *
 * @param {string} baseUrl - Drupal's base URL.
 * @param {object} [options] - Options.
 * @param {number} [options.interval] - Milliseconds between checks.
 * @param {Function} [options.log] - Logs a line.
 * @param {Function} [options.ready] - The readiness check.
 * @returns {Promise<void>} Resolves when Drupal is ready.
 */
const waitForBackend = async (baseUrl, { interval = 5000, log = () => {}, ready = backendReady } = {}) => {
  const started = Date.now()
  let logged = 0
  while (!(await ready(baseUrl))) {
    if (Date.now() - logged >= 60000) {
      log(`waiting for Drupal at ${baseUrl} (${Math.round((Date.now() - started) / 1000)}s)`)
      logged = Date.now()
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

/**
 * The first of Lagoon's routes that a service answers on.
 *
 * @param {string} routes - LAGOON_ROUTES: comma-separated URLs.
 * @param {string} service - The service name, the first label of its routes.
 * @returns {string|undefined} The route, if the service has one.
 */
const serviceRoute = (routes, service) =>
  String(routes || '')
    .split(',')
    .map((route) => route.trim())
    .find((route) => {
      try {
        return new URL(route).hostname.startsWith(`${service}.`)
      } catch (e) {
        return false
      }
    })

module.exports = { backendReady, getJson, serviceRoute, waitForBackend }
