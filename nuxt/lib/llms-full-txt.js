/**
 * Builder for `/llms-full.txt`, the whole guide as one document.
 *
 * Companion to `/llms.txt`. Where that file is an index of URLs, this is the
 * text those URLs contain, concatenated in reading order, so an assistant can
 * ingest the documentation in one request instead of following 58 links.
 *
 * Not part of the standard at https://llmstxt.org, which defines `llms.txt`
 * alone. It is a
 * convention, indexed by the public directories alongside `llms.txt` and
 * reported there with a token count, which is the practical argument for
 * emitting it.
 *
 * Two things a naive `cat content/**\/*.md` gets wrong and this does not:
 * frontmatter would be published as literal `---` blocks, and the guide's links
 * are root-relative (`/how-to/proxy`), which resolve to nothing once the text is
 * read outside the site. Both are handled below.
 *
 * Pure and side-effect free, so it can be unit tested without a build.
 */

const { SITE_ORIGIN, SITE_NAME, SITE_DESCRIPTION, SECTIONS } = require('./site')

/**
 * Sections, in the order a reader would meet them: the guide first, then the
 * generated reference. Deliberately not alphabetical, because `weight` in the
 * frontmatter encodes a reading order that a directory glob would discard.
 *
 * The API reference is included here where llms.txt lists only package indexes.
 * The two files have different problems. In an index, 111 near-identical link
 * lines really would bury the 50 that describe what the project is. In the
 * full text the same pages are substantive and compact: measured against the
 * live site, the API is about 131KB once changelogs are dropped, against 184KB
 * for the hand-written guide. It is smaller than the prose, not an order of
 * magnitude larger, and a file called `llms-full.txt` that omitted every
 * component signature would be answering questions about props from memory.
 */
const SECTION_ORDER = ['tutorials', 'how-to', 'explanation', 'modules', 'api']

/**
 * Per-package changelogs, excluded.
 *
 * Eleven pages at roughly 6.5KB each, so about 69KB and 18% of the whole file:
 * the largest pages in the reference by a factor of five. They are release
 * history, which helps nothing answer how to use Druxt, and the same
 * information is a git log away.
 */
const isChangelog = (route) => route.endsWith('/CHANGELOG')

/**
 * Rewrite root-relative links to absolute ones.
 *
 * Inside the site `[proxy](/how-to/proxy)` resolves against the origin. In a
 * single text file read by something that never visited the site, it resolves
 * against nothing, so every internal cross-reference is silently lost. Only the
 * `](/...)` form is touched: protocol-relative `//host` and absolute URLs are
 * left alone.
 *
 * @param {string} markdown - Document body.
 * @param {string} origin - Absolute origin, no trailing slash.
 * @returns {string} The body with internal links absolute.
 */
const toAbsoluteUrls = (markdown, origin) => markdown.replace(
  /\]\((\/(?!\/)[^)]*)\)/g,
  (match, route) => '](' + origin + route + ')',
)

/**
 * Render `/llms-full.txt`.
 *
 * Includes the generated API reference, minus per-package changelogs. See
 * SECTION_ORDER for why this differs from llms.txt, which lists package indexes
 * only.
 *
 * @param {Array<object>} docs - Documents from readContent(), carrying `content`.
 * @param {object} [options] - Overrides, for tests.
 * @param {string} [options.origin] - Absolute origin for URLs.
 * @returns {string} The complete file contents, newline terminated.
 */
const buildLlmsFullTxt = (docs, options) => {
  const origin = (options || {}).origin || SITE_ORIGIN

  const lines = [
    '# ' + SITE_NAME,
    '',
    '> ' + SITE_DESCRIPTION,
    '',
    'This is the complete documentation as a single document. The index version, '
      + 'with one line per page, is at ' + origin + '/llms.txt.',
  ]

  SECTION_ORDER.forEach((section) => {
    const entries = docs
      .filter((doc) => doc.section === section && (doc.content || '').trim() && !isChangelog(doc.route))
      .sort((a, b) => (a.weight - b.weight) || a.route.localeCompare(b.route))

    if (!entries.length) return

    lines.push('', '---', '', '# ' + SECTIONS[section].label, '', SECTIONS[section].description)

    entries.forEach((doc) => {
      // A rule before every document, not just before every section. Bodies
      // carry their own `##` headings, so a document title at the same level is
      // not a reliable boundary: 38 documents contribute around 240 `##`
      // headings between them. The rule and the Source line delimit documents
      // without rewriting body markdown, which would corrupt the `#` comments
      // inside the shell fences.
      lines.push(
        '',
        '---',
        '',
        '## ' + doc.title,
        '',
        'Source: ' + origin + doc.route,
        '',
        toAbsoluteUrls(doc.content.trim(), origin),
      )
    })
  })

  lines.push('')
  return lines.join('\n')
}

module.exports = { buildLlmsFullTxt, toAbsoluteUrls, isChangelog, SECTION_ORDER }
