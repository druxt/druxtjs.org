// Shared reading of the authored documentation corpus.
//
// The survey that sets the migration's baseline and the builder that produces
// the content Drupal imports both parse the same files, and if they disagreed
// the baseline would be asserting against a corpus the importer never saw. So
// they share one parser rather than one convention.
//
// Deliberately not a markdown library: this needs a block tokenizer whose
// output can be serialised back to byte-identical source, which a general AST
// does not give without carrying original positions through every transform.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/** Where the documentation repository keeps the authored markdown. */
const CONTENT_DIR = 'docs/nuxt/content'

/** Where the documentation repository keeps the files the markdown embeds. */
const STATIC_DIR = 'docs/nuxt/static'

/** Paths served by docgen output rather than by authored markdown. */
const GENERATED_PREFIXES = ['/api', '/components', '/modules']
const GENERATED_EXACT = new Set(['/how-to/contributing'])

/** Filenames whose route is their containing directory. */
const INDEX_NAMES = ['README', 'index']

/** Languages the corpus fences code in, and the model accepts. */
const CODE_LANGUAGES = ['js', 'sh', 'vue', 'html', 'text', 'nginx', 'yaml', 'json']

/** Fence syntaxes that are diagrams rather than code. */
const DIAGRAM_SYNTAXES = ['mermaid']

const FENCE = /^(\s*)(`{3,}|~{3,})\s*([A-Za-z0-9_+-]*)\s*$/
const STANDALONE_IMAGE = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/
const CALLOUT_LEAD = /^>\s*\*\*([^*]+?):?\*\*/
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

/**
 * Callout leads the corpus uses, mapped to the model's callout types.
 *
 * `prerequisite` is the "Before you start" convention, uniform across every
 * callout in the corpus. `output` is quoted program output, which is a sample
 * rather than prose: monospaced, never translated, excluded from prose
 * linting.
 */
const CALLOUT_TYPES = [{ type: 'prerequisite', test: (lead) => /^before you start$/i.test(lead) }]

/** A blockquote that quotes runtime output rather than prose. */
const OUTPUT_QUOTE = /^>\s*(\[[a-z-]+\]|Missing Vue template)/

/**
 * The authored markdown files, from git rather than from the filesystem.
 *
 * A checkout that has run `build:docs` has the generated corpus on disk too,
 * and listing the directory would migrate it. Asking git keeps a developer
 * checkout and a clean one reading the same set.
 *
 * @param {string} root - Root of the documentation checkout.
 * @returns {string[]} Checkout-relative paths, sorted.
 */
function trackedContentFiles(root) {
  return execFileSync('git', ['ls-files', CONTENT_DIR], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter((file) => file.endsWith('.md'))
    .sort()
}

/**
 * Splits frontmatter from body.
 *
 * The corpus uses flat scalar keys only. Anything else is reported rather than
 * guessed at, so a document that grows a nested value fails loudly instead of
 * migrating with a field silently missing.
 *
 * @param {string} source - Complete file contents.
 * @returns {{frontmatter: object, body: string, unparsed: string[]}} The parts.
 */
function splitFrontmatter(source) {
  if (!source.startsWith('---\n')) return { frontmatter: {}, body: source, unparsed: [] }
  const end = source.indexOf('\n---\n', 4)
  if (end === -1) return { frontmatter: {}, body: source, unparsed: [] }

  const frontmatter = {}
  const unparsed = []
  for (const line of source.slice(4, end).split('\n')) {
    if (!line.trim()) continue
    const match = /^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/.exec(line)
    if (!match) {
      unparsed.push(line)
      continue
    }
    const raw = match[2].trim()
    frontmatter[match[1]] = /^-?\d+$/.test(raw) ? Number(raw) : raw.replace(/^["'](.*)["']$/, '$1')
  }

  return { frontmatter, body: source.slice(end + 5), unparsed }
}

/**
 * Splits a body into top-level blocks.
 *
 * Fenced regions are captured whole, so a blank line or a `>` inside an
 * example never splits or misclassifies it. An indented fence belongs to the
 * list item enclosing it and stays inside that block: lifting it out would
 * destroy the numbered steps around it.
 *
 * @param {string} body - The document body.
 * @returns {{blocks: object[], nested: object[]}} Top-level blocks, and the
 *   fences that stayed inside one.
 */
function tokenize(body) {
  const lines = body.split('\n')
  const blocks = []
  const nested = []
  let buffer = []
  let bufferStart = 1
  let lineNo = 0

  const flush = () => {
    while (buffer.length && !buffer[buffer.length - 1].trim()) buffer.pop()
    if (buffer.length) blocks.push({ kind: 'text', lines: buffer, line: bufferStart })
    buffer = []
  }

  const consumeFence = (marker) => {
    const content = []
    const closer = new RegExp(`^\\s*${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`)
    lineNo += 1
    let closed = false
    while (lineNo < lines.length) {
      if (closer.test(lines[lineNo])) {
        closed = true
        lineNo += 1
        break
      }
      content.push(lines[lineNo])
      lineNo += 1
    }
    return { content, closed }
  }

  while (lineNo < lines.length) {
    const line = lines[lineNo]
    const fence = FENCE.exec(line)

    if (fence) {
      const [, indent, marker, lang] = fence
      const start = lineNo + 1

      if (indent !== '') {
        const opening = line
        const { content, closed } = consumeFence(marker)
        buffer.push(opening, ...content)
        if (closed) buffer.push(`${indent}${marker}`)
        nested.push({ lang: lang || '', line: start, closed, code: content.join('\n') })
        continue
      }

      flush()
      const { content, closed } = consumeFence(marker)
      blocks.push({
        kind: 'fence',
        marker,
        lang: lang || '',
        code: content.join('\n'),
        line: start,
        closed,
      })
      bufferStart = lineNo + 1
      continue
    }

    if (!line.trim()) {
      flush()
      lineNo += 1
      bufferStart = lineNo + 1
      continue
    }

    if (!buffer.length) bufferStart = lineNo + 1
    buffer.push(line)
    lineNo += 1
  }
  flush()

  return { blocks, nested }
}

/**
 * The kind of content a tokenized block holds.
 *
 * @param {object} block - A block from tokenize().
 * @returns {string} One of the corpus block kinds.
 */
function classify(block) {
  if (block.kind === 'fence') {
    return DIAGRAM_SYNTAXES.includes(block.lang) ? 'diagram' : 'code'
  }

  const first = block.lines[0]
  if (block.lines.length === 1 && STANDALONE_IMAGE.test(first.trim())) return 'image'
  if (/^#{1,6}\s/.test(first)) return 'heading'
  if (first.startsWith('>')) {
    if (CALLOUT_LEAD.test(first)) return 'callout'
    return OUTPUT_QUOTE.test(first) ? 'output' : 'blockquote'
  }
  if (/^\|.*\|/.test(first)) return 'table'
  if (/^([-*+]|\d+\.)\s/.test(first)) return 'list'
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(first.trim())) return 'rule'
  if (/^<[A-Za-z]/.test(first.trim())) return 'html'
  return 'paragraph'
}

/**
 * The callout type for a callout block, or null when the lead is unknown.
 *
 * @param {object} block - A block classified as a callout.
 * @returns {string|null} The model's callout type.
 */
function calloutType(block) {
  const lead = (CALLOUT_LEAD.exec(block.lines[0]) || [])[1]
  if (!lead) return null
  const match = CALLOUT_TYPES.find((candidate) => candidate.test(lead.trim()))
  return match ? match.type : null
}

/**
 * The public route for a content file.
 *
 * Mirrors lib/content-index.js: an index file serves its containing
 * directory, so `how-to/README.md` is `/how-to`, not `/how-to/README`.
 *
 * @param {string} file - Checkout-relative path.
 * @returns {string} The route path.
 */
function routeFor(file) {
  const relative = file.slice(`${CONTENT_DIR}/`.length).replace(/\.md$/, '')
  const segments = relative.split('/')
  if (INDEX_NAMES.includes(segments[segments.length - 1])) segments.pop()
  return `/${segments.join('/')}`
}

/**
 * Whether a site-root-relative path is served by generated output.
 *
 * @param {string} target - A path beginning with `/`.
 * @returns {boolean} True when docgen owns it.
 */
function isGeneratedPath(target) {
  const [pathPart] = target.split('#')
  return (
    GENERATED_EXACT.has(pathPart) ||
    GENERATED_PREFIXES.some((prefix) => pathPart === prefix || pathPart.startsWith(`${prefix}/`))
  )
}

/**
 * Every link in a body, with its kind.
 *
 * Image references are excluded: they are not links, and counting them as
 * such is what inflated the figures this migration was first scoped against.
 *
 * @param {string} body - The document body.
 * @returns {object[]} `{target, kind}` per occurrence.
 */
function extractLinks(body) {
  const links = []
  for (const match of body.replace(IMAGE, '').matchAll(LINK)) {
    const target = match[1]
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) links.push({ target, kind: 'external' })
    else if (target.startsWith('#')) links.push({ target, kind: 'anchor' })
    else if (!target.startsWith('/')) links.push({ target, kind: 'relative' })
    else links.push({ target, kind: 'internal' })
  }
  return links
}

/**
 * Every image reference in a body.
 *
 * @param {string} body - The document body.
 * @returns {object[]} `{src, alt}` per occurrence.
 */
function extractImages(body) {
  return [...body.matchAll(IMAGE)].map((match) => ({ alt: match[1], src: match[2] }))
}

/**
 * Reads and parses one content file.
 *
 * @param {string} root - Root of the documentation checkout.
 * @param {string} file - Checkout-relative path.
 * @returns {object} Frontmatter, body and tokenized blocks.
 */
function readDocument(root, file) {
  const source = readFileSync(path.join(root, file), 'utf8')
  const { frontmatter, body, unparsed } = splitFrontmatter(source)
  const { blocks, nested } = tokenize(body)
  return {
    file,
    route: routeFor(file),
    section: file.slice(`${CONTENT_DIR}/`.length).split('/')[0],
    isLanding: INDEX_NAMES.includes(path.basename(file, '.md')),
    frontmatter,
    unparsed,
    body,
    blocks,
    nested,
  }
}

export {
  CODE_LANGUAGES,
  CONTENT_DIR,
  DIAGRAM_SYNTAXES,
  GENERATED_EXACT,
  GENERATED_PREFIXES,
  STATIC_DIR,
  calloutType,
  classify,
  extractImages,
  extractLinks,
  isGeneratedPath,
  readDocument,
  routeFor,
  splitFrontmatter,
  tokenize,
  trackedContentFiles,
}
