/**
 * Unlighthouse configuration: a Lighthouse audit over the whole generated site.
 *
 * Run by the `audit:seo` CI job, which serves `dist/` on :4000 and audits it.
 * Never imported by the Nuxt build: unlighthouse needs a newer Node than this
 * site is pinned to, so the job runs on its own image.
 */

/**
 * Every route, read out of the generated sitemap in `dist/`.
 *
 * Read from the build being served, not from `content/`, which the CI job does
 * not receive. Audit coverage and sitemap coverage are then the same set.
 *
 * Resolved once at config load; this version does not read the callback form.
 *
 * @returns {string[]} Route paths, or an empty list if the sitemap is missing.
 */
function sitemapRoutes() {
  try {
    const fs = require('fs')
    const path = require('path')
    const xml = fs.readFileSync(path.join(__dirname, 'dist', 'sitemap.xml'), 'utf8')

    return (xml.match(/<loc>([^<]+)<\/loc>/g) || [])
      // Strip the canonical origin: unlighthouse discards sitemap entries
      // whose origin differs from the localhost site it is auditing.
      .map((tag) => tag.replace(/<\/?loc>/g, '').replace(/^https?:\/\/[^/]+/, ''))
      .map((route) => route || '/')
  } catch (e) {
    // Never take the audit down over the route list; the crawler below still
    // finds the linked pages.
    return []
  }
}

/**
 * Reduce a route list to a representative sample, grouped by page shape.
 *
 * Routes are grouped by section and depth, a proxy for the page template that
 * renders them, then taken round robin so every template is sampled.
 *
 * Deterministic, so two runs of the same build audit the same routes.
 *
 * @param {string[]} routes - Every route, in sitemap order.
 * @param {number} limit - Maximum routes to keep; 0 keeps all of them.
 * @returns {string[]} The sampled routes.
 */
function sampleRoutes(routes, limit) {
  if (!limit || routes.length <= limit) return routes

  const groups = new Map()
  routes.forEach((route) => {
    const segments = route.split('/').filter(Boolean)
    const key = (segments[0] || 'home') + ':' + segments.length
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(route)
  })

  const buckets = [...groups.keys()].sort().map((key) => groups.get(key))
  const sample = []
  for (let i = 0; sample.length < limit; i++) {
    const before = sample.length
    for (const bucket of buckets) {
      if (i >= bucket.length || sample.length >= limit) continue
      sample.push(bucket[i])
    }
    // Every bucket is exhausted; nothing further to take.
    if (sample.length === before) break
  }

  return sample.sort()
}

/**
 * Routes to audit: an explicit list for content-only pull requests, otherwise
 * every route, sampled when UNLIGHTHOUSE_SAMPLE asks for it.
 *
 * UNLIGHTHOUSE_ROUTES is a comma-separated list derived from the changed files.
 * It is intersected with the sitemap, so a renamed page cannot be audited into
 * a 404, and the crawler is disabled alongside it.
 */
const explicitRoutes = (process.env.UNLIGHTHOUSE_ROUTES || '')
  .split(',')
  .map((route) => route.trim())
  .filter(Boolean)

const allRoutes = sitemapRoutes()
const routes = explicitRoutes.length
  ? allRoutes.filter((route) => explicitRoutes.includes(route))
  : sampleRoutes(allRoutes, Number(process.env.UNLIGHTHOUSE_SAMPLE || 0))

module.exports = {
  site: 'http://localhost:4000',

  // One Chromium per worker, and unlighthouse defaults to the host's core
  // count, which exhausts memory.
  puppeteerClusterOptions: {
    // Concurrent browsers. One on a shared runner, more where the runner is
    // dedicated; each pipeline sets what its hardware can carry.
    maxConcurrency: Number(process.env.UNLIGHTHOUSE_CONCURRENCY || 1),

    // Per-route budget, raised from the 300000 default so a busy runner is not
    // reported as a site failure. The job timeout is the real ceiling.
    timeout: 900000,
  },

  puppeteerOptions: {
    // Chromium's sandbox needs user namespaces, which CI containers withhold.
    // Safe here: the only thing rendered is the site's own build.
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],

    // Use an already-installed Chromium when one is named: unlighthouse
    // downloads an x86_64 build, which will not run on an arm64 runner.
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  },

  // Parsed out of dist/sitemap.xml with the origin stripped.
  urls: routes,

  scanner: {
    // A floor for the full audit, so an unreadable route list does not degrade
    // to a near-empty run. Off for an explicit list, which crawling would undo.
    crawler: explicitRoutes.length === 0,

    // No dynamicSampling: supplying `urls` turns unlighthouse's own sampling
    // off, so it would be a no-op. sampleRoutes above does the sampling.
  },

  ci: {
    // 0 until a baseline exists; set it from the first green run's numbers.
    budget: 0,
  },
}
