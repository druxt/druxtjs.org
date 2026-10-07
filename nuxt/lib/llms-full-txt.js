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

/** Whether a document goes into the file: a guide or reference page with a body. */
const included = (doc) =>
  SECTION_ORDER.includes(doc.section) && (doc.content || '').trim() && !isChangelog(doc.route)

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
      .filter((doc) => doc.section === section && included(doc))
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

/** The HTML block tags CommonMark lets interrupt a paragraph (its type 6). */
const BLOCK_TAGS = new Set(
  'address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul'.split(
    ' '
  )
)

/** The leading spaces of a line. */
const indentOf = (line) => line.length - line.trimStart().length

/**
 * A fence marker on a line, past a list item's marker if the line opens one.
 *
 * @param {string} line - The line.
 * @returns {?{ char: string, length: number, indent: number, info: string }} The
 *   marker, with the column its block's content starts at.
 */
const fenceMarker = (line) => {
  const item = /^( {0,3}(?:[-*+]|\d{1,9}[.)]) {1,4})/.exec(line)
  const rest = item ? line.slice(item[1].length) : line
  const marker = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(rest)
  if (!marker) return null
  return { char: marker[2][0], length: marker[2].length, indent: item ? item[1].length : 0, info: marker[3] }
}

/**
 * Walk markdown the way a CommonMark reader does, tracking code fences.
 *
 * Fences, HTML blocks and list items are the containers that change what a
 * `#` means: inside a fence or an HTML block it is text, and a fence opened
 * inside a list item is closed by a marker indented to that item, while a
 * marker dedented past the item ends the item and opens a fence of its own.
 *
 * @param {string} markdown - Text to scan.
 * @returns {{ headings: Array<{ line: number, level: number, text: string }>, open: ?number }}
 *   Headings outside fences, at every level, and the line of a fence left open.
 */
const scanFences = (markdown) => {
  const headings = []
  const lines = markdown.split('\n')
  let fence = null
  // An HTML block: a comment runs to its `-->`, any other tag to a blank line.
  let html = null
  // Whether the line before was paragraph text: what a setext underline needs.
  let text = false

  const read = (line, index) => {
    if (fence) {
      // Inside a list item, a non-blank line indented less than the item ends it,
      // and with it the fence; the line is then read afresh.
      if (fence.indent && line.trim() && indentOf(line) < fence.indent) {
        fence = null
        return read(line, index)
      }
      // The closer sits at the fence's own column, up to three spaces past it,
      // which inside a list item is past the three a bare marker may take.
      const run = line.trimStart()
      const closes =
        indentOf(line) <= fence.indent + 3 && run[0] === fence.char
        && /^(`+|~+)\s*$/.test(run) && run.trim().length >= fence.length
      if (closes) fence = null
      text = false
      return
    }
    if (html) {
      if (html === 'comment') {
        if (line.includes('-->')) html = null
      } else if (html === 'tag') {
        if (!line.trim()) html = null
      } else if (new RegExp('</' + html + '>', 'i').test(line)) html = null
      text = false
      return
    }
    if (/^ {0,3}<!--/.test(line)) {
      html = line.includes('-->') ? null : 'comment'
      text = false
      return
    }
    // A raw-text element runs to its closing tag, blank lines included.
    const raw = /^ {0,3}<(pre|script|style|textarea)(?=[\s>]|$)/i.exec(line)
    if (raw) {
      html = new RegExp('</' + raw[1] + '>', 'i').test(line) ? null : raw[1].toLowerCase()
      text = false
      return
    }
    // A known block tag opens an HTML block anywhere; any other tag only
    // between paragraphs, since it cannot interrupt one.
    const tag = /^ {0,3}<\/?([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>]|$)/.exec(line)
    if (tag && (!text || BLOCK_TAGS.has(tag[1].toLowerCase()))) {
      html = 'tag'
      return
    }
    const opener = fenceMarker(line)
    if (opener && !(opener.char === '`' && opener.info.includes('`'))) {
      fence = { ...opener, line: index + 1 }
      text = false
      return
    }
    const heading = /^ {0,3}(#{1,6})(\s|$)/.exec(line)
    // A setext heading: a line of = or - under paragraph text, which
    // CommonMark reads as an H1 or H2 just as it reads the # forms.
    const underline = /^ {0,3}(=+|-+)\s*$/.exec(line)
    if (heading) headings.push({ line: index + 1, level: heading[1].length, text: line })
    else if (underline && text) headings.push({ line: index, level: underline[1][0] === '=' ? 1 : 2, text: lines[index - 1] })
    // A list item's first line is not paragraph text an underline can follow:
    // the underline would have to be indented to the item to belong to it.
    text = !heading && !underline && !/^ {0,3}(?:[-*+]|\d{1,9}[.)])(\s|$)/.test(line) && Boolean(line.trim())
  }

  lines.forEach(read)

  return { headings, open: fence && fence.line }
}

/**
 * Problems with the outline a reader of `/llms-full.txt` would parse.
 *
 * Bodies pass through untouched, so `# .env` inside a shell fence stays a
 * comment. That holds only while every fence closes: one left open swallows
 * what follows, and an H1 in a body claims the sections after it. Either
 * mis-attributes pages for anything splitting the file by heading. Each body is
 * checked on its own as well, because a fence left open mid-file pairs with the
 * next one and can leave the file as a whole looking balanced.
 *
 * @param {Array<object>} docs - Documents the file was built from.
 * @param {string} text - The rendered file.
 * @returns {Array<string>} Problems found, empty when the outline is sound.
 */
const outlineProblems = (docs, text) => {
  const expected = ['# ' + SITE_NAME, ...SECTION_ORDER.map((section) => '# ' + SECTIONS[section].label)]
  const problems = []

  // Only the pages the file carries: a fence left open in a changelog, which
  // the file drops, breaks nothing. An H1 in a body is reported here with its
  // page, whatever its text: one that reads like a section heading would
  // otherwise pass the file-level check below.
  const inBodies = new Set()
  docs.filter(included).forEach((doc) => {
    const body = scanFences(doc.content)
    if (body.open) problems.push(doc.route + ' line ' + body.open + ': code fence never closes')
    body.headings
      .filter((heading) => heading.level === 1)
      .forEach((heading) => {
        inBodies.add(heading.text)
        problems.push(doc.route + ' line ' + heading.line + ': top-level heading "' + heading.text + '" in a page body')
      })
  })

  const file = scanFences(text)
  file.headings
    .filter((heading) => heading.level === 1)
    .filter((heading) => !expected.includes(heading.text) && !inBodies.has(heading.text))
    .forEach((heading) => problems.push('line ' + heading.line + ': unexpected top-level heading "' + heading.text + '"'))
  if (file.open) problems.push('line ' + file.open + ': code fence never closes')

  return problems
}

module.exports = { buildLlmsFullTxt, outlineProblems, scanFences, toAbsoluteUrls, isChangelog, SECTION_ORDER }
