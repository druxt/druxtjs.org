// Turns a tokenized page into the typed blocks the content model stores,
// and back into markdown for the round-trip. Needs nothing from
// node_modules, so its unit tests run without an install.

import {
  CODE_LANGUAGES,
  DIAGRAM_SYNTAXES,
  calloutType,
  classify,
  extractImages,
} from './corpus.mjs'

/** A defect that stops the run, collected so one pass reports all of them. */
export class Defects {
  constructor() {
    this.items = []
  }

  add(file, line, message) {
    this.items.push({ file, line, message })
  }

  get failed() {
    return this.items.length > 0
  }

  report() {
    for (const { file, line, message } of this.items) {
      process.stderr.write(`${file}:${line}: ${message}\n`)
    }
    process.stderr.write(`\n${this.items.length} defects; nothing written.\n`)
  }
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

/**
 * Turns one tokenized block into its IR form.
 *
 * Returns null when the block joins the prose accumulating around it, which
 * is how headings, lists, tables and ordinary blockquotes reach the model:
 * inside a text block, not beside one.
 *
 * @param {object} block - A tokenized block.
 * @param {object} context - `{file, defects, images}`.
 * @returns {object|null} The IR block, or null to accumulate as prose.
 */
function toBlock(block, context) {
  const kind = classify(block)

  switch (kind) {
    case 'code': {
      if (!block.lang) {
        context.defects.add(context.file, block.line, 'fenced code with no language')
        return null
      }
      if (!CODE_LANGUAGES.includes(block.lang)) {
        context.defects.add(
          context.file,
          block.line,
          `fence language "${block.lang}" is outside the model's set (${CODE_LANGUAGES.join(', ')})`
        )
        return null
      }
      if (!block.closed) {
        context.defects.add(context.file, block.line, 'unclosed fence')
        return null
      }
      return { type: 'code', language: block.lang, code: block.code }
    }

    case 'diagram': {
      if (!DIAGRAM_SYNTAXES.includes(block.lang)) return null
      return { type: 'diagram', syntax: block.lang, source: block.code }
    }

    case 'image': {
      const [image] = extractImages(block.lines[0])
      if (!image.alt.trim()) {
        context.defects.add(context.file, block.line, `image with no alt text: ${image.src}`)
        return null
      }
      // Only an earlier version passes `images`. There, an image today's
      // corpus does not migrate with this alt text has no media to point at.
      if (context.images && context.images.get(image.src) !== image.alt) {
        context.defects.add(
          context.file,
          block.line,
          `image today's corpus does not migrate with this alt text, kept as markdown: ${image.src}`
        )
        return null
      }
      return { type: 'image', src: image.src, alt: image.alt }
    }

    case 'callout': {
      const type = calloutType(block)
      if (!type) {
        context.defects.add(
          context.file,
          block.line,
          `callout lead not recognised: ${block.lines[0].slice(0, 60)}`
        )
        return null
      }
      return { type: 'callout', callout: type, markdown: block.lines.join('\n') }
    }

    case 'output':
      return { type: 'callout', callout: 'output', markdown: block.lines.join('\n') }

    case 'html': {
      const raw = block.lines.join('\n')
      if (/^<div\b/.test(raw.trim())) return { type: '__wrapper', open: true, raw }
      if (/^<\/div>/.test(raw.trim())) return { type: '__wrapper', open: false, raw }
      context.defects.add(
        context.file,
        block.line,
        `raw HTML block: ${block.lines[0].slice(0, 60)}`
      )
      return null
    }

    default:
      return null
  }
}

/** A fence's markdown, rebuilt from its parts as serialise() rebuilds code. */
function fence(block) {
  return `${block.marker}${block.lang}\n${block.code}${block.closed ? `\n${block.marker}` : ''}`
}

/**
 * Builds the ordered block list for a document.
 *
 * Prose accumulates until something typed interrupts it, which is what keeps
 * a heading with the paragraphs beneath it and a list with the fences its
 * steps contain.
 *
 * The options are for an earlier version of a page, which cannot be edited
 * and so is parsed without dropping anything:
 *
 *   keepRefused  keeps a fence the model refuses, verbatim, in the prose
 *                around it. The current version drops it and fails.
 *   images       maps path to alt text for the images today's corpus
 *                migrates. Any other image stays in the prose as markdown.
 *
 * @param {object} doc - A document from readDocument().
 * @param {Defects} defects - Collector.
 * @param {object} [options] - `{keepRefused, images}`.
 * @returns {object[]} The IR blocks.
 */
export function buildBlocks(doc, defects, options = {}) {
  const context = { file: doc.file, defects, images: options.images ?? null }
  const blocks = []
  const presentation = []
  let prose = []
  let group = null
  let groupCount = 0

  const flushProse = () => {
    if (!prose.length) return
    blocks.push({ type: 'text', markdown: prose.join('\n\n') })
    prose = []
  }

  for (const block of doc.blocks) {
    const built = toBlock(block, context)

    if (built && built.type === '__wrapper') {
      // Layout, not content: recorded with the block index it sits in front
      // of, so the source can be rebuilt exactly, while the model stores only
      // the group id it implies. Flushed first, because the wrapper belongs
      // between the prose above it and the diagrams below.
      flushProse()
      group = built.open ? `group-${(groupCount += 1)}` : null
      presentation.push({ before: blocks.length, raw: built.raw })
      continue
    }

    if (!built) {
      // A fence only comes back null with a defect recorded. For the current
      // version the run then fails before anything is written, so there is
      // no prose to keep. An earlier version keeps it.
      if (block.kind !== 'fence') prose.push(block.lines.join('\n'))
      else if (options.keepRefused) prose.push(fence(block))
      continue
    }

    flushProse()
    if (built.type === 'diagram' && group) built.group = group
    blocks.push(built)
  }
  flushProse()

  return { blocks, presentation }
}

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

/**
 * Rebuilds a page's markdown from its IR blocks.
 *
 * @param {object[]} blocks - IR blocks.
 * @param {object[]} presentation - Wrappers the model does not store, with
 *   the block index each sits in front of.
 * @returns {string} The reconstructed body.
 */
export function serialise(blocks, presentation = []) {
  const pieces = blocks.map((block) => {
    switch (block.type) {
      case 'code':
        return '```' + block.language + '\n' + block.code + '\n```'
      case 'diagram':
        return '```' + block.syntax + '\n' + block.source + '\n```'
      case 'image':
        return `![${block.alt}](${block.src})`
      case 'callout':
        return block.markdown
      default:
        return block.markdown
    }
  })

  // Reinserted from the end, so an earlier index is not shifted by a later
  // insertion.
  for (const entry of [...presentation].sort((a, b) => b.before - a.before)) {
    pieces.splice(entry.before, 0, entry.raw)
  }

  return pieces.join('\n\n')
}

/**
 * The only differences a round-trip is allowed to forgive.
 *
 * Written down and bounded on purpose: a comparison whose normalisation can
 * be widened until it passes is not a comparison. Adding to this list is a
 * finding, not a fix.
 *
 *   1. Trailing whitespace on a line.
 *   2. Runs of blank lines collapsed to one.
 *   3. Leading and trailing blank lines.
 *
 * @param {string} markdown - Either side of the comparison.
 * @returns {string} The normalised form.
 */
export function normalise(markdown) {
  return markdown
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
