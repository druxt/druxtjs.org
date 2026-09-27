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
 * The revision Drupal reports having finished deploying.
 *
 * Three answers, and the caller needs to tell them apart: a revision
 * string, `null` where the endpoint answered but no rollout has recorded
 * one yet, and `undefined` where there is no endpoint to ask, which is
 * every backend deployed before it existed.
 *
 * @param {string} baseUrl - Drupal's base URL.
 * @returns {Promise<string|null|undefined>} The revision, or null, or undefined.
 */
const deployedRevision = async (baseUrl) => {
  const body = await getJson(new URL('/druxt-docs/deployment', baseUrl).href)
  if (!body || typeof body !== 'object' || !('revision' in body)) return undefined
  return typeof body.revision === 'string' && body.revision !== '' ? body.revision : null
}

/**
 * Whether Drupal has finished deploying the revision this build is from.
 *
 * The footer-menu check this replaces asks whether the documentation is
 * there, which an established site answers yes to throughout a rollout,
 * including while its database updates and configuration import are still
 * running. A frontend that builds then reads the previous release's
 * display configuration. Comparing revisions asks the question that
 * actually matters.
 *
 * It gives way rather than blocking, in two cases. Without a revision of
 * its own there is nothing to compare, so the gate does not apply: that is
 * local development. Where the endpoint is absent the backend predates
 * this check, so it falls back to the footer-menu probe.
 *
 * @param {string} baseUrl - Drupal's base URL.
 * @param {object} [options] - Options.
 * @param {string} [options.revision] - The revision this build is from.
 * @param {Function} [options.fallback] - The check used when there is no endpoint.
 * @returns {Promise<boolean>} True once Drupal is ready to build against.
 */
const deploymentReady = async (baseUrl, { revision, fallback = backendReady } = {}) => {
  if (!revision) return fallback(baseUrl)
  const reported = await deployedRevision(baseUrl)
  if (reported === undefined) return fallback(baseUrl)
  return reported === revision
}

/**
 * Wait until Drupal is ready, logging once a minute until it is.
 *
 * The wait is bounded. Holding the port indefinitely behind the starting
 * page is a worse failure for a documentation site than building against a
 * backend that is a release behind, and the next rollout corrects the
 * latter. Passing the bound is logged plainly so it is never mistaken for
 * a clean start.
 *
 * @param {string} baseUrl - Drupal's base URL.
 * @param {object} [options] - Options.
 * @param {number} [options.interval] - Milliseconds between checks.
 * @param {number} [options.timeout] - Milliseconds before giving up and proceeding.
 * @param {Function} [options.log] - Logs a line.
 * @param {Function} [options.ready] - The readiness check.
 * @returns {Promise<boolean>} True if Drupal became ready, false if the wait was abandoned.
 */
const waitForBackend = async (
  baseUrl,
  { interval = 5000, timeout = 900000, log = () => {}, ready = backendReady } = {},
) => {
  const started = Date.now()
  let logged = 0
  while (!(await ready(baseUrl))) {
    const waited = Date.now() - started
    if (timeout > 0 && waited >= timeout) {
      log(
        `giving up waiting for Drupal at ${baseUrl} after ${Math.round(waited / 1000)}s, and building anyway: this build may be against a backend that has not finished deploying`,
      )
      return false
    }
    if (Date.now() - logged >= 60000) {
      log(`waiting for Drupal at ${baseUrl} (${Math.round(waited / 1000)}s)`)
      logged = Date.now()
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  return true
}

/**
 * The routes LAGOON_ROUTES lists, parsed; anything that is not a URL is dropped.
 *
 * @param {string} routes - LAGOON_ROUTES: comma-separated URLs.
 * @returns {URL[]} The parsed routes.
 */
const parsedRoutes = (routes) =>
  String(routes || '')
    .split(',')
    .map((route) => route.trim())
    .map((route) => {
      try {
        return new URL(route)
      } catch (e) {
        return null
      }
    })
    .filter(Boolean)

/**
 * The route a service answers on, preferring its custom domain: Lagoon lists
 * the autogenerated `*.amazee.io` route alongside any custom routes, and the
 * public domain must win when there is one, or canonical links, the sitemap,
 * llms.txt and the Storybook link all name the preview host.
 *
 * The custom routes are recognized by the project's domain: the site's own
 * host first, then a `service.`-labelled subdomain like the Storybook one.
 * Anything else — other services' routes, localhost, single-label container
 * names — is not this service's to claim.
 *
 * @param {string} routes - LAGOON_ROUTES: comma-separated URLs.
 * @param {string} service - The service name, the first label of its autogenerated routes.
 * @param {string} [domain] - The project's public domain.
 * @returns {string|undefined} The route's origin, if the service has one.
 */
const serviceRoute = (routes, service, domain = 'druxtjs.org') => {
  const urls = parsedRoutes(routes)
  const hostnames = urls.map((url) => url.hostname)
  // The apex and www belong to the site's frontend alone; a sibling
  // service (Storybook) only ever answers on its own labelled route.
  if (service === 'nuxt') {
    const site = hostnames.indexOf(domain)
    if (site !== -1) return urls[site].origin
    const www = hostnames.indexOf(`www.${domain}`)
    if (www !== -1) return urls[www].origin
  }
  const labelled = urls.filter((url) => url.hostname.startsWith(`${service}.`))
  const custom = labelled.find((url) => !url.hostname.endsWith('.amazee.io'))
  if (custom) return custom.origin
  return labelled[0] && labelled[0].origin
}

/**
 * The origin canonical links, share cards and the machine-readable indexes
 * name: the configured override, else the frontend URL, both taken as they
 * are, else the service's custom route. A production environment never
 * names its autogenerated route: when its custom routes are missing, the
 * public domain is still the origin worth linking.
 *
 * @param {object} env - The process environment.
 * @returns {string|undefined} The origin, without a trailing slash.
 */
const resolveOrigin = (env) => {
  const configured = env.SITE_ORIGIN || env.DRUXT_FRONTEND_URL
  if (configured) return configured.replace(/\/+$/, '')
  const origin = serviceRoute(env.LAGOON_ROUTES, 'nuxt')
  if (!origin) return undefined
  const hostname = new URL(origin).hostname
  if (env.LAGOON_ENVIRONMENT_TYPE === 'production' && hostname.endsWith('.amazee.io')) {
    return 'https://druxtjs.org'
  }
  return origin.replace(/\/+$/, '')
}

module.exports = {
  backendReady,
  deployedRevision,
  deploymentReady,
  getJson,
  resolveOrigin,
  serviceRoute,
  waitForBackend,
}
