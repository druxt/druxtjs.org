/**
 * What a Drupal purge tells open pages.
 *
 * Purge posts the invalidated cache tags to druxt's `/_druxt/cache/clear`,
 * which checks the secret and empties the server's cache but ignores the
 * body. This reads the body alongside it and, once druxt has accepted the
 * request, hands the tags on.
 */

/** Tags Drupal purges that no page shows: sign-in tokens and consumers. */
const BOOKKEEPING = /^(oauth2_token|consumer|session)(_list)?(:|$)/
const TAG = /^[\w:.-]{1,128}$/
/** A batch bigger than this names more than it lists: treated as everything. */
const LIMIT = 64 * 1024

/**
 * The tags in a purge body, comma separated. None means everything changed.
 *
 * @param {string} body - The request body.
 * @returns {string[]} The tags.
 */
const tagsFrom = (body) =>
  body.length > LIMIT
    ? []
    : body
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => TAG.test(tag))

/**
 * Whether a purge touches anything a page shows.
 *
 * @param {string[]} tags - The purged tags.
 * @returns {boolean} False for a batch of sign-in bookkeeping only.
 */
const isContentChange = (tags) => !tags.length || !tags.every((tag) => BOOKKEEPING.test(tag))

/**
 * Watches each request for an accepted purge.
 *
 * @param {(tags: string[]) => void} onPurge - Called with the tags of each accepted purge.
 * @param {object} [options]
 * @param {string} [options.path] - druxt's cache clear route.
 * @returns {(req: object, res: object) => void} Called before the request is handled.
 */
const watchPurges =
  (onPurge, { path = '/_druxt/cache/clear' } = {}) =>
  (req, res) => {
    if (req.method !== 'POST' || String(req.url || '').split('?')[0] !== path) return
    let body = ''
    let over = false
    let ended = false
    let finished = false
    const done = () => {
      if (!ended || !finished || res.statusCode !== 204) return
      const tags = over ? [] : tagsFrom(body)
      if (isContentChange(tags)) onPurge(tags)
    }
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      if (over) return
      body += chunk
      if (body.length > LIMIT) {
        over = true
        body = ''
      }
    })
    req.on('end', () => {
      ended = true
      done()
    })
    res.on('finish', () => {
      finished = true
      done()
    })
  }

module.exports = { BOOKKEEPING, isContentChange, tagsFrom, watchPurges }
