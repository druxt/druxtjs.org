#!/usr/bin/env node
// Converts the authored documentation into the intermediate representation
// the Drupal importer consumes: one JSON document per page, holding the
// frontmatter, the computed table of contents, and an ordered list of typed
// blocks matching the content model's paragraph bundles.
//
// Markdown parsing lives here rather than in PHP because this is where the
// markdown is, and because a round-trip check that needs no database is the
// cheap half of proving the migration lossless. Every block carries its
// source verbatim, so the serialiser below can rebuild the page and compare
// it against the file it came from.
//
// Nothing is guessed. A construct no rule covers, a fence in a language the
// model does not accept, or a link that resolves to nothing stops the run
// with the file and line named, because a page that migrates with a section
// quietly missing looks exactly like one that did not.
//
// Each page also carries its earlier versions from the documentation's git
// history, parsed by the same code, for the importer to save as dated
// revisions. An earlier version cannot be edited, so a defect in one is
// noted rather than fatal. What it cannot do is lose content: a version its
// blocks do not rebuild stops the run, as the current version does.
//
// Usage:
//   node scripts/build-ir.mjs --source <checkout> [--out <dir>] [--check]
//
//   --source  a git checkout of the documentation repository.
//   --out     directory to write the documents to, with every image the
//             pages embed copied under static/, so the importer reads one
//             directory and never the checkout.
//   --check   round-trip every page and report, writing nothing.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { Defects, buildBlocks, normalise, serialise } from './lib/blocks.mjs'
import { assertFullHistory, contentAt, dates, log, versions } from './lib/history.mjs'
import { revisions } from './lib/revisions.mjs'
import {
  CONTENT_DIR,
  STATIC_DIR,
  extractImages,
  extractLinks,
  isGeneratedPath,
  readDocument,
  routeFor,
  trackedContentFiles,
} from './lib/corpus.mjs'

export { normalise, serialise }

const require = createRequire(import.meta.url)

// github-slugger, the same implementation @nuxt/content reaches through
// remark-slug, so stored anchors and the ids the current site renders agree
// by construction rather than by a reimplementation that drifts.
const GithubSlugger = require('github-slugger')

// ---------------------------------------------------------------------------
// Table of contents
// ---------------------------------------------------------------------------

/**
 * The headings a page renders, with the ids the site gives them.
 *
 * Drupal computes the same list from a page's paragraphs whenever field_toc
 * is read, and the import fails unless the two agree, so this is the
 * reference that port is held to. Headings inside fenced code are excluded:
 * the tokenizer has already separated them, so a `# comment` in a shell
 * example cannot appear.
 *
 * @param {object} doc - A document from readDocument().
 * @returns {object[]} `{id, depth, text}` per heading.
 */
function buildToc(doc) {
  const slugger = new GithubSlugger()
  const toc = []
  for (const block of doc.blocks) {
    if (block.kind === 'fence') continue
    for (const line of block.lines) {
      const match = /^(#{1,6})\s+(.*?)\s*$/.exec(line)
      if (!match) continue
      const text = match[2].replace(/`([^`]*)`/g, '$1').trim()
      toc.push({ id: slugger.slug(text), depth: match[1].length, text })
    }
  }
  return toc
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * Builds the IR for every authored page.
 *
 * @param {string} root - Root of the documentation checkout.
 * @returns {{documents: object[], defects: Defects, notes: object[]}} The
 *   result, with what earlier versions kept as prose and why.
 */
export function build(root) {
  assertFullHistory(root)
  const defects = new Defects()
  const notes = []
  const files = trackedContentFiles(root)
  const routes = new Set(files.map(routeFor))
  const documents = []
  const commits = new Map()

  for (const file of files) {
    const doc = readDocument(root, file)

    for (const line of doc.unparsed) {
      defects.add(file, 1, `frontmatter this parser does not understand: ${line}`)
    }
    for (const key of ['title', 'description']) {
      if (!doc.frontmatter[key]) defects.add(file, 1, `frontmatter is missing ${key}`)
    }

    for (const link of extractLinks(doc.body)) {
      if (link.kind !== 'internal') continue
      const [pathPart] = link.target.split('#')
      if (routes.has(pathPart) || isGeneratedPath(link.target)) continue
      defects.add(file, 1, `internal link resolves to neither an authored page nor generated output: ${link.target}`)
    }

    for (const image of extractImages(doc.body)) {
      if (!image.src.startsWith('/') || !existsSync(path.join(root, STATIC_DIR, image.src))) {
        defects.add(file, 1, `image is not a file under ${STATIC_DIR}: ${image.src}`)
      }
    }

    const { blocks, presentation } = buildBlocks(doc, defects)
    commits.set(file, log(root, file))

    documents.push({
      source: file,
      url: doc.route,
      section: doc.section,
      isLanding: doc.isLanding,
      title: doc.frontmatter.title ?? null,
      description: doc.frontmatter.description ?? null,
      weight: doc.frontmatter.weight ?? null,
      toc: buildToc(doc),
      ...dates(commits.get(file)),
      links: extractLinks(doc.body).map((link) => ({
        ...link,
        resolves: link.kind !== 'internal'
          ? link.kind
          : (routes.has(link.target.split('#')[0]) ? 'authored' : 'generated'),
      })),
      images: extractImages(doc.body),
      blocks,
      presentation,
      // Kept so validation can compare without re-reading the source tree,
      // and so a defect found later can be traced to what was parsed.
      sourceBody: doc.body,
    })
  }

  // Earlier versions come after every current page, because whether an
  // image in one can point at today's media depends on every image the
  // current corpus migrates.
  const images = new Map(documents.flatMap((doc) => doc.blocks
    .filter((block) => block.type === 'image')
    .map((block) => [block.src, block.alt])))

  for (const doc of documents) {
    const earlier = versions(commits.get(doc.source), (commit) => contentAt(root, commit))
    // The newest version is the page as read, unless the checkout holds an
    // edit git has not recorded. That edit is then the current version, and
    // every committed version is history.
    if (earlier.at(-1)?.content === readFileSync(path.join(root, doc.source), 'utf8')) earlier.pop()
    const built = revisions(earlier, images, doc.title)
    for (const entry of built) {
      notes.push(...entry.notes)
      if (!entry.rebuilds) {
        defects.add(`${entry.revision.path}@${entry.revision.sha.slice(0, 12)}`, 1, 'an earlier version its blocks do not rebuild, so its revision would not say what the page said')
      }
    }
    doc.revisions = built.map((entry) => entry.revision)
  }

  return { documents, defects, notes }
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? null : args[index + 1]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const source = flag('source')
  if (!source) {
    process.stderr.write('--source <checkout> is required: the documentation repository to build from.\n')
    process.exit(2)
  }
  if (!existsSync(path.join(source, '.git'))) {
    process.stderr.write(`${source} is not a git checkout. The corpus is listed with git, so it needs one.\n`)
    process.exit(2)
  }

  const { documents, defects, notes } = build(source)

  // An empty corpus is a wrong checkout, not a documentation set with no
  // pages: the importer must not be handed nothing and read it as success.
  if (!documents.length) {
    process.stderr.write(`No tracked files under ${CONTENT_DIR} in ${source}. Is this a checkout of the documentation repository?\n`)
    process.exit(1)
  }

  if (defects.failed) {
    defects.report()
    process.exit(1)
  }

  // Reported, not fatal: an earlier version cannot be fixed, and what it
  // kept as prose is still in its revision.
  for (const { file, line, message } of notes) {
    process.stderr.write(`note: ${file}:${line}: ${message}\n`)
  }

  let mismatched = 0
  for (const doc of documents) {
    const rebuilt = normalise(serialise(doc.blocks, doc.presentation))
    const original = normalise(doc.sourceBody)
    if (rebuilt !== original) {
      mismatched += 1
      process.stderr.write(`${doc.source}: does not round-trip\n`)
      const a = original.split('\n')
      const b = rebuilt.split('\n')
      for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        if (a[i] !== b[i]) {
          process.stderr.write(`  line ${i + 1}\n    source: ${JSON.stringify(a[i])}\n    rebuilt: ${JSON.stringify(b[i])}\n`)
          break
        }
      }
    }
  }

  if (mismatched) {
    process.stderr.write(`\n${mismatched} of ${documents.length} pages do not round-trip; nothing written.\n`)
    process.exit(1)
  }

  const earlier = documents.reduce((count, doc) => count + doc.revisions.length, 0)
  const out = flag('out')
  if (args.includes('--check') || !out) {
    process.stdout.write(`${documents.length} pages, all round-trip.\n`)
    const blocks = {}
    for (const doc of documents) {
      for (const block of doc.blocks) blocks[block.type] = (blocks[block.type] || 0) + 1
    }
    for (const [type, count] of Object.entries(blocks).sort((a, b) => b[1] - a[1])) {
      process.stdout.write(`  ${type.padEnd(10)} ${count}\n`)
    }
    process.stdout.write(`${earlier} earlier versions, all rebuilt from their blocks.\n`)
    process.exit(0)
  }

  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  for (const doc of documents) {
    const name = doc.source.replace(`${CONTENT_DIR}/`, '').replace(/\//g, '__').replace(/\.md$/, '.json')
    // Dropped rather than written: it exists so validation can compare
    // without re-reading the source tree, and duplicating every page's body
    // into the IR on disk would double the artifact for no reader.
    const document = { ...doc }
    delete document.sourceBody
    writeFileSync(path.join(out, name), `${JSON.stringify(document, null, 2)}\n`)
  }

  const images = new Set(documents.flatMap((doc) => doc.images.map((image) => image.src)))
  for (const src of images) {
    const target = path.join(out, 'static', src)
    mkdirSync(path.dirname(target), { recursive: true })
    copyFileSync(path.join(source, STATIC_DIR, src), target)
  }
  process.stdout.write(`${documents.length} documents and ${images.size} images written to ${out}\n`)
  process.stdout.write(`${earlier} earlier versions carried for the importer to save as revisions.\n`)
}
