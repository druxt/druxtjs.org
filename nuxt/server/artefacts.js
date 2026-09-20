/**
 * `sitemap.xml`, `llms.txt` and `llms-full.txt`, built from what the site
 * actually serves.
 *
 * These used to be written into `static/` once, when the container started,
 * from the markdown corpus baked into the image at its pinned commit. Two
 * consequences, both of which were live defects: a page authored in Drupal
 * was served to readers while absent from all three files, and no amount of
 * redeploying fixed it, because a redeploy rebuilt them from the same pin.
 *
 * They are built on request instead, from the authored pages in Drupal
 * merged with the generated reference pages the image still carries, and
 * held for a time to live. So a page published in Drupal appears once that
 * elapses, with no deployment.
 */

const { buildSitemap } = require('../lib/sitemap')
const { buildLlmsTxt } = require('../lib/llms-txt')
const { buildLlmsFullTxt } = require('../lib/llms-full-txt')
const { readContent } = require('../lib/content-index')
const { fetchDrupalDocs, mergeCorpus } = require('../lib/drupal-corpus')

/** What each path is called and how it is built. */
const ARTEFACTS = {
  '/sitemap.xml': { type: 'application/xml; charset=utf-8', build: buildSitemap },
  '/llms.txt': { type: 'text/plain; charset=utf-8', build: buildLlmsTxt },
  '/llms-full.txt': { type: 'text/plain; charset=utf-8', build: buildLlmsFullTxt },
}

/** The paths this serves. Exported so the page cache can leave them alone. */
const ARTEFACT_PATHS = Object.keys(ARTEFACTS)

/**
 * Whether a request is for one of these.
 *
 * @param {string} method - The HTTP method.
 * @param {string} pathname - The request path.
 * @returns {boolean} True for a GET or HEAD of an artefact path.
 */
const isArtefact = (method, pathname) =>
  (method === 'GET' || method === 'HEAD') && Object.prototype.hasOwnProperty.call(ARTEFACTS, pathname)

/**
 * Serve the artefacts, rebuilding each no more often than its time to live.
 *
 * @param {object} options - Options.
 * @param {string} options.baseUrl - Drupal's base URL.
 * @param {string} options.contentDir - The generated content tree.
 * @param {string} options.origin - The origin URLs are written against.
 * @param {number} [options.ttl] - Milliseconds a built artefact is held.
 * @param {Function} [options.log] - Logs a line.
 * @param {Function} [options.fetchDocs] - The Drupal reader, for tests.
 * @param {Function} [options.readGenerated] - The content-tree reader, for tests.
 * @returns {{ isArtefact: Function, corpus: Function, handle: Function }} The server.
 */
const createArtefacts = ({
  baseUrl,
  contentDir,
  origin,
  ttl = 300000,
  log = () => {},
  fetchDocs = fetchDrupalDocs,
  readGenerated = readContent,
}) => {
  const held = new Map()
  let building = null
  let corpusHeld = null

  // One corpus read serves every artefact for the length of the time to
  // live. Without this a cold start queries Drupal for the whole corpus
  // three times, once per artefact, and concurrent crawlers multiply it.
  const corpus = async () => {
    if (corpusHeld && Date.now() - corpusHeld.at < ttl) return corpusHeld.docs
    if (building) return building
    building = (async () => {
      const generated = readGenerated(contentDir)
      const authored = await fetchDocs(baseUrl, { log })
      const merged = mergeCorpus(authored, generated)
      log(`artefacts: ${authored.length} authored and ${generated.length} generated pages, ${merged.length} merged`)
      corpusHeld = { docs: merged, at: Date.now() }
      return merged
    })()
    try {
      return await building
    } finally {
      building = null
    }
  }

  const bodyFor = async (pathname) => {
    const fresh = held.get(pathname)
    if (fresh && Date.now() - fresh.at < ttl) return fresh.body

    let docs
    try {
      docs = await corpus()
    } catch (error) {
      log(`artefacts: ${pathname} not rebuilt: ${error.message}`)
      // A stale answer beats no answer: a crawler that gets a 500 may drop
      // every URL it had.
      return fresh ? fresh.body : null
    }

    const body = ARTEFACTS[pathname].build(docs, { origin })
    held.set(pathname, { body, at: Date.now() })
    return body
  }

  const handle = async (req, res) => {
    const pathname = req.url.split('?')[0]
    const body = await bodyFor(pathname)
    if (body === null) {
      res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' })
      return res.end('Not built yet')
    }
    res.writeHead(200, {
      'Content-Type': ARTEFACTS[pathname].type,
      'Content-Length': Buffer.byteLength(body),
      // Held briefly at the edge as well, on the same reasoning as the
      // server's own hold: fresh enough to follow the content, cheap enough
      // not to rebuild per crawler.
      'Cache-Control': `public, max-age=${Math.round(ttl / 1000)}`,
    })
    return res.end(req.method === 'HEAD' ? undefined : body)
  }

  return { isArtefact, corpus, handle }
}

module.exports = { ARTEFACT_PATHS, createArtefacts, isArtefact }
