/**
 * Pre-cache: render every page once, so Druxt's server cache holds Drupal's
 * responses before a visitor asks for them.
 *
 * The first warm runs while the starting page still holds the port. Each
 * clear from Drupal empties Druxt's cache, so a successful clear schedules
 * another, of the authored pages only: the stored pages and Druxt's cache
 * fill again together, and an edit shows without waiting for a stored page to
 * go stale. The generated pages refresh as they go stale, as before.
 */
const { crawl } = require('./page-cache')

/** Druxt's clear endpoint, which Purge calls on every save. */
const CLEAR_PATH = '/_druxt/cache/clear'

/**
 * @param {object} options - Options.
 * @param {Function} options.seeds - Resolves to the paths the first warm starts from, following links.
 * @param {Function} [options.refresh] - Resolves to the paths a warm after a clear renders, without following
 *   links. Defaults to `seeds`.
 * @param {Function} options.store - Renders one path, resolving to its HTML or null.
 * @param {Function} [options.log] - Writes one line.
 * @param {number} [options.delay] - Milliseconds after a clear before warming, so a burst of clears warms once.
 * @param {number} [options.timeout] - Milliseconds the first warm may hold the start.
 * @param {Function} [options.crawler] - The crawl, replaceable in tests.
 * @returns {object} `{ run, schedule, first, watchClears }`.
 */
const createWarmer = ({ seeds, refresh = seeds, store, log = () => {}, delay = 5000, timeout = 120000, crawler = crawl }) => {
  let running = null
  let again = false
  let timer = null

  // One warm at a time. A clear during a warm asks for one more after it.
  const run = ({ full = false } = {}) => {
    if (running) {
      again = true
      return running
    }
    const started = Date.now()
    running = (async () => {
      try {
        const paths = await (full ? seeds : refresh)()
        // A refresh stops at its own paths: the crawl's limit counts the seeds first.
        const result = await crawler(full ? { seeds: paths, store } : { seeds: paths, store, limit: paths.length })
        log(`warmed ${result.stored} of ${result.visited} pages in ${Math.round((Date.now() - started) / 1000)}s`)
        return result
      } catch (error) {
        log(`warm failed: ${error.message}`)
        return null
      } finally {
        running = null
        if (again) {
          again = false
          schedule()
        }
      }
    })()
    return running
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(run, delay)
    if (timer.unref) timer.unref()
  }

  // The first warm, waited for at most `timeout`: a slow backend never holds
  // the start, and the warm carries on behind the live site.
  const first = () => {
    let limit
    const expired = new Promise((resolve) => {
      limit = setTimeout(() => resolve(null), timeout)
      if (limit.unref) limit.unref()
    })
    return Promise.race([run({ full: true }), expired]).finally(() => clearTimeout(limit))
  }

  // Wraps a request listener: a clear that Druxt answers 204 schedules a warm.
  const watchClears = (listener) => (req, res) => {
    if (req.method === 'POST' && String(req.url || '').split('?')[0] === CLEAR_PATH) {
      res.on('finish', () => {
        if (res.statusCode === 204) schedule()
      })
    }
    return listener(req, res)
  }

  return { run, schedule, first, watchClears }
}

module.exports = { CLEAR_PATH, createWarmer }
