#!/usr/bin/env node
// Inventories the hand-authored documentation corpus: what sections exist,
// what frontmatter is carried, what block kinds the bodies use, which code
// fence languages appear, and where the internal links point.
//
// This is the measurement the Drupal content model is derived from, and the
// baseline the migration's validation counts assert against. It is a script
// rather than a one-off reading so that the numbers can be re-derived after
// the corpus changes, instead of quietly going stale in a spec.
//
// Input is the git-tracked authored content only. The 122 files docgen emits
// (content/api, content/components, modules/*/README.md, how-to/contributing.md)
// are excluded by consulting content/.gitignore, so a developer checkout that
// has run `build:docs` surveys the same corpus as a clean one.
//
// Usage:
//   node scripts/survey-content.mjs --source <checkout> [--json <path>] [--markdown <path>]
//
//   --source  a git checkout of the documentation repository.

import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
// The same reader the IR builder uses. Two parsers of one corpus would let
// the baseline assert against a corpus the importer never saw, which is the
// drift this shares code to prevent.
import {
  CONTENT_DIR,
  classify,
  extractImages,
  extractLinks,
  isGeneratedPath,
  readDocument,
  routeFor,
  trackedContentFiles,
} from './lib/corpus.mjs'

const CALLOUT_LEAD = /^>\s*\*\*([^*]+?):?\*\*/

function survey(root) {
  const files = trackedContentFiles(root)
  const pages = []
  const frontmatterKeys = new Map()
  const blockKinds = new Map()
  const fenceLangs = new Map()
  const images = new Map()
  const linkTargets = new Map()
  const calloutLeads = new Map()
  const nestedFenceLangs = new Map()
  const blockquotes = []
  const htmlBlocks = []
  const anomalies = []

  for (const file of files) {
    const doc = readDocument(root, file)
    const { frontmatter, body } = doc

    for (const line of doc.unparsed) {
      anomalies.push({ file, kind: 'unparsed-frontmatter', detail: line })
    }
    for (const key of Object.keys(frontmatter)) {
      frontmatterKeys.set(key, (frontmatterKeys.get(key) || 0) + 1)
    }

    const blocks = doc.blocks
    const kinds = {}
    for (const block of blocks) {
      const kind = classify(block)
      kinds[kind] = (kinds[kind] || 0) + 1
      blockKinds.set(kind, (blockKinds.get(kind) || 0) + 1)

      if (block.kind === 'fence') {
        const lang = block.lang || '(none)'
        fenceLangs.set(lang, (fenceLangs.get(lang) || 0) + 1)
        if (!block.closed) {
          anomalies.push({ file, kind: 'unclosed-fence', detail: `line ${block.line}` })
        }
        if (!block.lang) {
          anomalies.push({ file, kind: 'fence-without-language', detail: `line ${block.line}` })
        }
      }
      if (kind === 'callout') {
        const lead = CALLOUT_LEAD.exec(block.lines[0])[1].trim()
        calloutLeads.set(lead, (calloutLeads.get(lead) || 0) + 1)
      }
      if (kind === 'blockquote') {
        blockquotes.push({ file, line: block.line, first: block.lines[0].slice(0, 90) })
      }
      if (kind === 'html') {
        htmlBlocks.push({ file, line: block.line, opening: block.lines[0].trim().slice(0, 70) })
      }
    }

    for (const nested of doc.nested) {
      const lang = nested.lang || '(none)'
      nestedFenceLangs.set(lang, (nestedFenceLangs.get(lang) || 0) + 1)
      if (!nested.closed) {
        anomalies.push({ file, kind: 'unclosed-nested-fence', detail: `line ${nested.line}` })
      }
    }

    for (const image of extractImages(body)) {
      if (!images.has(image.src)) images.set(image.src, { alt: new Set(), refs: 0 })
      const entry = images.get(image.src)
      entry.alt.add(image.alt)
      entry.refs += 1
      if (!image.alt.trim()) anomalies.push({ file, kind: 'image-without-alt', detail: image.src })
    }

    for (const { target } of extractLinks(body)) {
      if (!linkTargets.has(target)) linkTargets.set(target, { count: 0, sources: new Set() })
      const entry = linkTargets.get(target)
      entry.count += 1
      entry.sources.add(file)
    }

    const section = file.slice(`${CONTENT_DIR}/`.length).split('/')[0]
    pages.push({
      file,
      url: routeFor(file),
      section,
      isLanding: path.basename(file) === 'README.md',
      title: frontmatter.title ?? null,
      description: frontmatter.description ?? null,
      weight: frontmatter.weight ?? null,
      blocks: kinds,
      headings: (body.match(/^#{1,6}\s.+$/gm) || []).length,
    })
  }

  // Link classification needs the full page set, so it happens after the walk.
  const urls = new Set(pages.map((p) => p.url))
  const links = {
    internalMigrated: [],
    internalGenerated: [],
    internalUnknown: [],
    external: [],
    anchor: [],
  }
  // Paths served by docgen output rather than by authored markdown. These
  // are the gitignored targets in content/.gitignore, so a link to one is
  // valid but will never resolve to a migrated page.
  for (const [target, entry] of linkTargets) {
    const record = { target, count: entry.count, sources: [...entry.sources] }
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) links.external.push(record)
    else if (target.startsWith('#')) links.anchor.push(record)
    else if (!target.startsWith('/')) links.internalUnknown.push(record)
    else {
      const [pathPart] = target.split('#')
      if (urls.has(pathPart)) links.internalMigrated.push(record)
      else if (isGeneratedPath(target)) links.internalGenerated.push(record)
      else links.internalUnknown.push(record)
    }
  }

  const bySection = {}
  for (const page of pages) {
    bySection[page.section] = (bySection[page.section] || 0) + 1
  }

  const sortedTally = (map) =>
    Object.fromEntries([...map].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))

  return {
    measuredAt: new Date().toISOString().slice(0, 10),
    ref: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    totals: {
      pages: pages.length,
      sections: Object.keys(bySection).length,
      internalLinkInstances: [
        ...links.internalMigrated,
        ...links.internalGenerated,
        ...links.internalUnknown,
      ].reduce((n, l) => n + l.count, 0),
      distinctInternalTargets:
        links.internalMigrated.length +
        links.internalGenerated.length +
        links.internalUnknown.length,
      distinctImages: images.size,
    },
    bySection,
    frontmatterKeys: sortedTally(frontmatterKeys),
    blockKinds: sortedTally(blockKinds),
    fenceLanguages: sortedTally(fenceLangs),
    nestedFenceLanguages: sortedTally(nestedFenceLangs),
    calloutLeads: sortedTally(calloutLeads),
    htmlBlocks,
    images: [...images]
      .map(([src, e]) => ({ src, refs: e.refs, alt: [...e.alt] }))
      .sort((a, b) => a.src.localeCompare(b.src)),
    links: {
      internalMigrated: links.internalMigrated.sort((a, b) => b.count - a.count),
      internalGenerated: links.internalGenerated.sort((a, b) => b.count - a.count),
      internalUnknown: links.internalUnknown.sort((a, b) => b.count - a.count),
      externalCount: links.external.reduce((n, l) => n + l.count, 0),
      distinctExternal: links.external.length,
      anchorCount: links.anchor.reduce((n, l) => n + l.count, 0),
    },
    blockquotesNotCallouts: blockquotes,
    anomalies,
    pages,
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function toMarkdown(s) {
  const row = (o) =>
    Object.entries(o)
      .map(([k, v]) => `| \`${k}\` | ${v} |`)
      .join('\n')
  const lines = []
  lines.push(`# Documentation corpus survey`)
  lines.push('')
  lines.push(
    `Measured ${s.measuredAt} at \`${s.ref.slice(0, 8)}\`, over git-tracked authored content only.`
  )
  lines.push('')
  lines.push('## Totals')
  lines.push('')
  lines.push('| Measure | Value |')
  lines.push('| ------- | ----- |')
  lines.push(row(s.totals))
  lines.push('')
  lines.push('## Pages per section')
  lines.push('')
  lines.push('| Section | Pages |')
  lines.push('| ------- | ----- |')
  lines.push(row(s.bySection))
  lines.push('')
  lines.push('## Frontmatter keys')
  lines.push('')
  lines.push('| Key | Pages carrying it |')
  lines.push('| --- | ----------------- |')
  lines.push(row(s.frontmatterKeys))
  lines.push('')
  lines.push('## Block kinds')
  lines.push('')
  lines.push('| Kind | Count |')
  lines.push('| ---- | ----- |')
  lines.push(row(s.blockKinds))
  lines.push('')
  lines.push('## Code fence languages')
  lines.push('')
  lines.push('| Language | Fences |')
  lines.push('| -------- | ------ |')
  lines.push(row(s.fenceLanguages))
  lines.push('')
  lines.push('## Code fences nested inside list items')
  lines.push('')
  lines.push('These cannot be lifted into sibling code paragraphs without')
  lines.push('destroying the list that encloses them.')
  lines.push('')
  lines.push('| Language | Fences |')
  lines.push('| -------- | ------ |')
  lines.push(
    Object.keys(s.nestedFenceLanguages).length ? row(s.nestedFenceLanguages) : '| (none) | 0 |'
  )
  lines.push('')
  lines.push('## Raw HTML blocks')
  lines.push('')
  if (!s.htmlBlocks.length) lines.push('None.')
  else {
    lines.push('| File | Line | Opening |')
    lines.push('| ---- | ---- | ------- |')
    for (const h of s.htmlBlocks) {
      lines.push(
        `| ${path.basename(h.file)} | ${h.line} | \`${h.opening.replace(/\|/g, '\\|')}\` |`
      )
    }
  }
  lines.push('')
  lines.push('## Callout leads')
  lines.push('')
  lines.push('| Lead | Count |')
  lines.push('| ---- | ----- |')
  lines.push(row(s.calloutLeads))
  lines.push('')
  lines.push('## Links')
  lines.push('')
  lines.push('| Class | Distinct targets | Instances |')
  lines.push('| ----- | ---------------- | --------- |')
  lines.push(
    `| internal, resolves to an authored page | ${s.links.internalMigrated.length} | ${s.links.internalMigrated.reduce((n, l) => n + l.count, 0)} |`
  )
  lines.push(
    `| internal, resolves to generated output | ${s.links.internalGenerated.length} | ${s.links.internalGenerated.reduce((n, l) => n + l.count, 0)} |`
  )
  lines.push(
    `| internal, resolves to neither | ${s.links.internalUnknown.length} | ${s.links.internalUnknown.reduce((n, l) => n + l.count, 0)} |`
  )
  lines.push(`| external | ${s.links.distinctExternal} | ${s.links.externalCount} |`)
  lines.push(`| bare anchor | | ${s.links.anchorCount} |`)
  lines.push('')
  if (s.links.internalUnknown.length) {
    lines.push('### Internal links resolving to neither')
    lines.push('')
    lines.push('| Target | Count | Sources |')
    lines.push('| ------ | ----- | ------- |')
    for (const l of s.links.internalUnknown) {
      lines.push(
        `| \`${l.target}\` | ${l.count} | ${l.sources.map((f) => path.basename(f)).join(', ')} |`
      )
    }
    lines.push('')
  }
  lines.push('## Images')
  lines.push('')
  lines.push('| Source | References |')
  lines.push('| ------ | ---------- |')
  for (const i of s.images) lines.push(`| \`${i.src}\` | ${i.refs} |`)
  lines.push('')
  lines.push('## Blockquotes that are not callouts')
  lines.push('')
  if (!s.blockquotesNotCallouts.length) lines.push('None.')
  else {
    lines.push('| File | Line | Opening |')
    lines.push('| ---- | ---- | ------- |')
    for (const b of s.blockquotesNotCallouts) {
      lines.push(`| ${path.basename(b.file)} | ${b.line} | ${b.first.replace(/\|/g, '\\|')} |`)
    }
  }
  lines.push('')
  lines.push('## Anomalies')
  lines.push('')
  if (!s.anomalies.length) lines.push('None.')
  else {
    lines.push('| File | Kind | Detail |')
    lines.push('| ---- | ---- | ------ |')
    for (const a of s.anomalies) {
      lines.push(`| ${path.basename(a.file)} | ${a.kind} | ${a.detail.replace(/\|/g, '\\|')} |`)
    }
  }
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? null : args[i + 1]
}

const source = flag('source')
if (!source) {
  process.stderr.write('--source <checkout> is required: the documentation repository to survey.\n')
  process.exit(2)
}
if (!existsSync(path.join(source, '.git'))) {
  process.stderr.write(
    `${source} is not a git checkout. The corpus is listed with git, so it needs one.\n`
  )
  process.exit(2)
}

if (!trackedContentFiles(source).length) {
  process.stderr.write(
    `No tracked files under ${CONTENT_DIR} in ${source}. Is this a checkout of the documentation repository?\n`
  )
  process.exit(1)
}

const result = survey(source)
const jsonPath = flag('json')
const markdownPath = flag('markdown')

if (jsonPath) {
  mkdirSync(path.dirname(jsonPath), { recursive: true })
  writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`)
}
if (markdownPath) {
  mkdirSync(path.dirname(markdownPath), { recursive: true })
  writeFileSync(markdownPath, toMarkdown(result))
}
if (!jsonPath && !markdownPath) process.stdout.write(toMarkdown(result))

if (result.anomalies.length) {
  process.stderr.write(`\n${result.anomalies.length} anomalies reported.\n`)
}
