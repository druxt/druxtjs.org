#!/usr/bin/env node
// Validates the committed Tome content against the documentation it was
// built from. Every check asserts an expected count or value taken from the
// committed baseline, the pinned source checkout or the IR, so an empty or
// partial content set fails rather than passing for want of errors.
//
//   node scripts/validate-content.mjs [--root <repo>] [--content <dir>]
//     [--files <dir>] [--ir <dir>] [--source <dir>] [--baseline <file>]
//     [--corpus]
//
// --corpus runs only the three checks that compare the IR against the
// pinned checkout and the baseline. They read no entity data, so they run
// straight after the IR is built and before anything is imported. The
// import asserts its page count against the IR document count, and both
// sides come from the same build, so an IR that quietly produced fewer
// documents would agree with itself. These are the checks that notice.
//
// Exits 1 when any check fails, naming the check and the page.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'

const CONTENT_ROOT = 'docs/nuxt/content'

// Arguments that take no value. Declared here rather than beside
// parseArgs, which runs while this module is still initialising.
const FLAGS = new Set(['corpus'])

const args = parseArgs(process.argv.slice(2))
const root = path.resolve(args.root ?? '.')
const dirs = {
  content: path.resolve(root, args.content ?? 'drupal/content'),
  files: path.resolve(root, args.files ?? 'drupal/files'),
  ir: path.resolve(root, args.ir ?? '.docs-ir'),
  source: path.resolve(root, args.source ?? '.docs-source'),
}
const baselinePath = path.resolve(root, args.baseline ?? 'scripts/content-baseline.json')

const results = []
const check = (name, ok, message, details = []) => {
  results.push({ name, ok, message, details })
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}: ${message}`)
  for (const line of details.slice(0, 25)) console.log(`         ${line}`)
  if (details.length > 25) console.log(`         ... and ${details.length - 25} more`)
}

main()

function main() {
  // The files directory only exists once an export has written media, so its
  // absence is reported by the image checks rather than aborting the run.
  const required = args.corpus ? ['ir', 'source'] : ['content', 'ir', 'source']
  for (const key of required) {
    if (!existsSync(dirs[key])) fail(`The ${key} directory does not exist: ${dirs[key]}`)
  }
  if (!existsSync(baselinePath)) fail(`The baseline does not exist: ${baselinePath}`)

  const baseline = readJson(baselinePath)
  const ir = loadIr(dirs.ir)
  const tracked = trackedPages(dirs.source)

  checkCorpus(baseline, ir, tracked)
  if (args.corpus) return report()

  const tome = loadTome(dirs.content)
  checkIndex(tome)
  const pages = checkPages(baseline, tome, tracked)
  checkSections(baseline, ir, tome, pages)
  checkFrontmatter(pages)
  checkBlocks(baseline, ir, tome, pages)
  checkImages(baseline, ir, tome, pages)

  report()
}

function report() {
  const failed = results.filter((r) => !r.ok)
  console.log('')
  console.log(`${results.length - failed.length} of ${results.length} checks passed.`)
  if (failed.length) {
    console.log(`Failed: ${failed.map((r) => r.name).join(', ')}`)
    process.exit(1)
  }
}

// The baseline and the IR must describe the checkout the content claims to
// come from, or every count below is checked against the wrong corpus.
function checkCorpus(baseline, ir, tracked) {
  // The counts below were measured at one commit. A pin bump without a fresh
  // survey would check the new corpus against the old numbers.
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: dirs.source,
    encoding: 'utf8',
  }).trim()
  check(
    'corpus.ref',
    baseline.ref === head,
    `baseline measured at ${String(baseline.ref).slice(0, 12)}, source checkout is at ${head.slice(0, 12)}`,
    baseline.ref === head ? [] : ['re-run scripts/survey-content.mjs against the pinned commit']
  )

  const irFiles = new Set(ir.map((doc) => doc.source))
  const missing = [...tracked].filter((file) => !irFiles.has(file))
  const extra = [...irFiles].filter((file) => !tracked.has(file))
  check(
    'corpus.ir',
    ir.length === tracked.size && !missing.length && !extra.length,
    `${ir.length} IR documents for ${tracked.size} tracked pages`,
    [...missing.map((f) => `not in IR: ${f}`), ...extra.map((f) => `not tracked: ${f}`)]
  )

  const baselineFiles = new Set(baseline.pages.map((page) => page.file))
  const stale = [...tracked].filter((file) => !baselineFiles.has(file))
  const gone = [...baselineFiles].filter((file) => !tracked.has(file))
  check(
    'corpus.baseline',
    baseline.totals.pages === tracked.size && !stale.length && !gone.length,
    `baseline counts ${baseline.totals.pages} pages, checkout has ${tracked.size}`,
    [...stale.map((f) => `not in baseline: ${f}`), ...gone.map((f) => `no longer tracked: ${f}`)]
  )
}

// Tome installs from the index, so an entry without a file or a file without
// an entry is content that installs differently from how it is committed.
function checkIndex(tome) {
  const indexed = new Set(Object.keys(tome.index))
  const present = new Set(tome.entities.map((e) => e.key))
  const orphaned = [...indexed].filter((key) => !present.has(key))
  const unindexed = [...present].filter((key) => !indexed.has(key))
  check(
    'index',
    indexed.size > 0 && !orphaned.length && !unindexed.length,
    `${indexed.size} index entries, ${present.size} content files`,
    [
      ...orphaned.map((k) => `indexed, no file: ${k}`),
      ...unindexed.map((k) => `file, not indexed: ${k}`),
    ]
  )
}

function checkPages(baseline, tome, tracked) {
  const nodes = tome.byType.node.filter((node) => bundle(node) === 'doc_page')
  const pages = nodes.map((node) => ({ node, source: value(node.field_source_path) }))
  check(
    'pages.count',
    pages.length === baseline.totals.pages,
    `expected ${baseline.totals.pages} pages, found ${pages.length}`
  )

  const sources = pages.map((page) => page.source)
  const seen = new Set(sources)
  const missing = [...tracked].filter((file) => !seen.has(file))
  const invented = sources.filter((file) => !tracked.has(file))
  const duplicated = sources.filter((file, i) => sources.indexOf(file) !== i)
  check(
    'pages.identity',
    !missing.length && !invented.length && !duplicated.length,
    `${seen.size} distinct source paths against ${tracked.size} tracked files`,
    [
      ...missing.map((f) => `missing: ${f}`),
      ...invented.map((f) => `not a tracked file: ${f}`),
      ...duplicated.map((f) => `duplicated: ${f}`),
    ]
  )

  const landing = new Set(baseline.pages.filter((page) => page.isLanding).map((page) => page.file))
  const wrong = pages
    .filter((page) => Boolean(value(page.node.field_is_landing)) !== landing.has(page.source))
    .map((page) => `${page.source}: ${landing.has(page.source) ? 'is' : 'is not'} a landing page`)
  const found = pages.filter((page) => value(page.node.field_is_landing)).length
  check(
    'pages.landing',
    found === landing.size && !wrong.length,
    `expected ${landing.size} landing pages, found ${found}`,
    wrong
  )
  return pages
}

function checkSections(baseline, ir, tome, pages) {
  const sectionBySource = new Map(ir.map((doc) => [doc.source, doc.section]))
  const terms = tome.byType.taxonomy_term.filter(
    (term) => target(term.vid) === 'documentation_section'
  )
  const slugByUuid = new Map(terms.map((term) => [uuid(term), value(term.description)]))
  check(
    'sections.terms',
    terms.length === baseline.totals.sections,
    `expected ${baseline.totals.sections} section terms, found ${terms.length}`
  )

  const counts = {}
  const details = []
  for (const page of pages) {
    const slug = slugByUuid.get(targetUuid(page.node.field_section))
    if (!slug) details.push(`${page.source}: no section term`)
    else {
      counts[slug] = (counts[slug] ?? 0) + 1
      if (sectionBySource.get(page.source) !== slug)
        details.push(
          `${page.source}: in ${slug}, the source says ${sectionBySource.get(page.source)}`
        )
    }
  }
  for (const [slug, expected] of Object.entries(baseline.bySection)) {
    if ((counts[slug] ?? 0) !== expected)
      details.push(`${slug}: expected ${expected}, found ${counts[slug] ?? 0}`)
  }
  for (const slug of Object.keys(counts)) {
    if (!(slug in baseline.bySection)) details.push(`${slug}: not a baseline section`)
  }
  check(
    'sections.count',
    !details.length,
    Object.entries(baseline.bySection)
      .map(([s, n]) => `${s} ${counts[s] ?? 0}/${n}`)
      .join(', '),
    details
  )
}

// Compared against the source file directly, not the IR, so the check does
// not share a code path with the builder it is checking.
function checkFrontmatter(pages) {
  const details = []
  for (const page of pages) {
    const file = path.join(dirs.source, page.source)
    if (!existsSync(file)) {
      details.push(`${page.source}: source file missing`)
      continue
    }
    const fm = frontmatter(readFileSync(file, 'utf8'))
    const stored = {
      title: value(page.node.title),
      description: value(page.node.field_description),
      weight: value(page.node.field_weight),
    }
    for (const key of ['title', 'description']) {
      if (stored[key] !== fm[key])
        details.push(
          `${page.source}: ${key} ${JSON.stringify(stored[key])} != ${JSON.stringify(fm[key])}`
        )
    }
    const weight = 'weight' in fm ? Number(fm.weight) : null
    const storedWeight =
      stored.weight === undefined || stored.weight === null ? null : Number(stored.weight)
    if (storedWeight !== weight) {
      details.push(`${page.source}: weight ${storedWeight} != ${weight}`)
    }
  }
  const withWeight = pages.filter(
    (p) =>
      existsSync(path.join(dirs.source, p.source)) &&
      'weight' in frontmatter(readFileSync(path.join(dirs.source, p.source), 'utf8'))
  ).length
  check(
    'frontmatter',
    pages.length > 0 && !details.length,
    `${pages.length} pages compared, ${withWeight} with a weight`,
    details
  )
}

// The paragraph sequence is compared block for block against the IR: same
// types in the same order, byte-identical code, diagram and markdown values.
function checkBlocks(baseline, ir, tome, pages) {
  const irBySource = new Map(ir.map((doc) => [doc.source, doc]))
  const details = []
  const languages = {}
  const callouts = {}
  let code = 0
  let diagrams = 0
  let compared = 0

  for (const page of pages) {
    const doc = irBySource.get(page.source)
    if (!doc) {
      details.push(`${page.source}: no IR document`)
      continue
    }
    const paragraphs = (page.node.field_content ?? []).map((ref) =>
      tome.byUuid.get(`paragraph.${ref.target_uuid}`)
    )
    const blocks = paragraphs.map((p, i) =>
      p ? paragraphBlock(p, tome) : { type: `missing paragraph ${i}` }
    )
    compared++
    if (blocks.length !== doc.blocks.length) {
      details.push(`${page.source}: ${blocks.length} paragraphs for ${doc.blocks.length} blocks`)
    }
    doc.blocks.forEach((expected, i) => {
      const found = blocks[i]
      if (!found) return
      const diff = blockDifference(expected, found)
      if (diff) details.push(`${page.source} block ${i + 1} (${expected.type}): ${diff}`)
    })
    for (const block of blocks) {
      if (block.type === 'code') {
        code++
        languages[block.language] = (languages[block.language] ?? 0) + 1
      }
      if (block.type === 'diagram') diagrams++
      if (block.type === 'callout') callouts[block.callout] = (callouts[block.callout] ?? 0) + 1
    }
  }
  check(
    'blocks.sequence',
    compared === pages.length && pages.length > 0 && !details.length,
    `${compared} pages compared block for block`,
    details
  )

  const expectedLanguages = Object.fromEntries(
    Object.entries(baseline.fenceLanguages).filter(([language]) => language !== 'mermaid')
  )
  const expectedCode = Object.values(expectedLanguages).reduce((a, b) => a + b, 0)
  const tally = []
  for (const [language, expected] of Object.entries(expectedLanguages)) {
    if ((languages[language] ?? 0) !== expected)
      tally.push(`${language}: expected ${expected}, found ${languages[language] ?? 0}`)
  }
  for (const language of Object.keys(languages)) {
    if (!(language in expectedLanguages)) tally.push(`${language}: not in the baseline`)
  }
  check(
    'code.tally',
    code === expectedCode && !tally.length,
    `${code} code paragraphs (expected ${expectedCode}), languages ${Object.keys(expectedLanguages).length}`,
    tally
  )

  const expectedDiagrams = baseline.fenceLanguages.mermaid ?? 0
  check(
    'diagrams.count',
    diagrams === expectedDiagrams,
    `expected ${expectedDiagrams} diagrams, found ${diagrams}`
  )

  const expectedCallouts = {
    prerequisite: baseline.blockKinds.callout ?? 0,
    output: baseline.blockKinds.output ?? 0,
  }
  const calloutDetails = Object.entries(expectedCallouts)
    .filter(([type, n]) => (callouts[type] ?? 0) !== n)
    .map(([type, n]) => `${type}: expected ${n}, found ${callouts[type] ?? 0}`)
  check(
    'callouts.tally',
    !calloutDetails.length,
    Object.entries(expectedCallouts)
      .map(([t, n]) => `${t} ${callouts[t] ?? 0}/${n}`)
      .join(', '),
    calloutDetails
  )
}

function checkImages(baseline, ir, tome, pages) {
  const media = tome.byType.media.filter((m) => bundle(m) === 'image')
  check(
    'images.media',
    media.length === baseline.totals.distinctImages,
    `expected ${baseline.totals.distinctImages} media entities, found ${media.length}`
  )

  const irBySource = new Map(ir.map((doc) => [doc.source, doc]))
  const details = []
  let paragraphs = 0
  for (const page of pages) {
    const doc = irBySource.get(page.source)
    if (!doc) continue
    const expected = doc.blocks.filter((b) => b.type === 'image')
    const found = (page.node.field_content ?? [])
      .map((ref) => tome.byUuid.get(`paragraph.${ref.target_uuid}`))
      .filter((p) => p && bundle(p) === 'docs_image')
    paragraphs += found.length
    found.forEach((paragraph, i) => {
      const item = tome.byUuid.get(`media.${targetUuid(paragraph.field_media)}`)
      if (!item) {
        details.push(`${page.source} image ${i + 1}: media missing`)
        return
      }
      const image = (item.field_media_image ?? [])[0]
      const file = image && tome.byUuid.get(`file.${image.target_uuid}`)
      if (!file) {
        details.push(`${page.source} image ${i + 1}: file entity missing`)
        return
      }
      // Tome exports public:// under a public/ directory of the files export.
      const relative = value(file.uri).replace(/^public:\/\//, 'public/')
      if (!existsSync(path.join(dirs.files, relative)))
        details.push(`${page.source} image ${i + 1}: ${relative} not in ${dirs.files}`)
      const want = expected[i]
      if (!want) return
      if (image.alt !== want.alt)
        details.push(
          `${page.source} image ${i + 1}: alt ${JSON.stringify(image.alt)} != ${JSON.stringify(want.alt)}`
        )
      if (path.basename(relative) !== path.basename(want.src))
        details.push(`${page.source} image ${i + 1}: ${relative} for ${want.src}`)
      const exported = path.join(dirs.files, relative)
      const canonical = path.join(dirs.ir, 'static', want.src)
      if (
        existsSync(exported) &&
        existsSync(canonical) &&
        !readFileSync(exported).equals(readFileSync(canonical))
      )
        details.push(
          `${page.source} image ${i + 1}: ${relative} differs from the source image ${want.src}`
        )
    })
  }
  const expectedParagraphs = baseline.blockKinds.image ?? 0
  check(
    'images.paragraphs',
    paragraphs === expectedParagraphs && !details.length,
    `expected ${expectedParagraphs} image paragraphs, found ${paragraphs}`,
    details
  )
}

function paragraphBlock(paragraph, tome) {
  switch (bundle(paragraph)) {
    case 'docs_text':
      return { type: 'text', markdown: value(paragraph.field_text) }
    case 'docs_code':
      return {
        type: 'code',
        language: value(paragraph.field_language),
        code: value(paragraph.field_code),
      }
    case 'docs_callout':
      return {
        type: 'callout',
        callout: value(paragraph.field_callout_type),
        markdown: value(paragraph.field_callout),
      }
    case 'docs_diagram':
      return {
        type: 'diagram',
        syntax: value(paragraph.field_syntax),
        source: value(paragraph.field_diagram),
      }
    case 'docs_image': {
      const item = tome.byUuid.get(`media.${targetUuid(paragraph.field_media)}`)
      return { type: 'image', alt: item ? (item.field_media_image ?? [])[0]?.alt : undefined }
    }
    default:
      return { type: bundle(paragraph) }
  }
}

function blockDifference(expected, found) {
  if (expected.type !== found.type) return `is ${found.type}`
  const fields = {
    text: ['markdown'],
    code: ['language', 'code'],
    callout: ['callout', 'markdown'],
    diagram: ['syntax', 'source'],
    image: ['alt'],
  }
  for (const field of fields[expected.type] ?? []) {
    if (expected[field] !== found[field])
      return `${field} differs (${describe(found[field])} for ${describe(expected[field])})`
  }
  return null
}

function loadIr(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => readJson(path.join(dir, f)))
    .filter((doc) => typeof doc.source === 'string' && Array.isArray(doc.blocks))
}

function loadTome(dir) {
  const indexPath = path.join(dir, 'meta', 'index.json')
  const index = existsSync(indexPath) ? readJson(indexPath) : {}
  const entities = []
  for (const name of readdirSync(dir).sort()) {
    const match = /^([a-z_]+)\.([0-9a-f-]{36})\.json$/.exec(name)
    if (!match) continue
    const entity = readJson(path.join(dir, name))
    entities.push({ key: `${match[1]}.${match[2]}`, type: match[1], entity })
  }
  const byType = { node: [], paragraph: [], media: [], file: [], taxonomy_term: [] }
  const byUuid = new Map()
  for (const { key, type, entity } of entities) {
    ;(byType[type] ??= []).push(entity)
    byUuid.set(key, entity)
  }
  return { index, entities, byType, byUuid }
}

function trackedPages(source) {
  const out = execFileSync(
    'git',
    ['-C', source, 'ls-files', '--', `${CONTENT_ROOT}/*.md`, `${CONTENT_ROOT}/**/*.md`],
    { encoding: 'utf8' }
  )
  return new Set(out.split('\n').filter(Boolean))
}

// The corpus writes one scalar per line, plain or quoted; anything else is
// reported rather than guessed at.
function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  const out = {}
  if (!match) return out
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([A-Za-z_]+):\s*(.*)$/.exec(line)
    if (!pair) continue
    let raw = pair[2].trim()
    if (/^'.*'$/.test(raw)) raw = raw.slice(1, -1).replace(/''/g, "'")
    else if (/^".*"$/.test(raw)) raw = JSON.parse(raw)
    else if (/^[>|]/.test(raw)) raw = `<unsupported block scalar: ${raw}>`
    out[pair[1]] = raw
  }
  return out
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z]+)$/.exec(argv[i])
    if (!m) fail(`Unexpected argument: ${argv[i]}`)
    if (FLAGS.has(m[1])) {
      out[m[1]] = true
      continue
    }
    if (argv[i + 1] === undefined) fail(`${argv[i]} needs a value.`)
    out[m[1]] = argv[++i]
  }
  return out
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}
function value(field) {
  return Array.isArray(field) && field.length ? field[0].value : undefined
}
function target(field) {
  return Array.isArray(field) && field.length ? field[0].target_id : undefined
}
function targetUuid(field) {
  return Array.isArray(field) && field.length ? field[0].target_uuid : undefined
}
function bundle(entity) {
  return target(entity.type) ?? target(entity.bundle)
}
function uuid(entity) {
  return value(entity.uuid)
}
function describe(v) {
  return v === undefined
    ? 'nothing'
    : JSON.stringify(String(v).length > 60 ? `${String(v).slice(0, 57)}...` : v)
}
function fail(message) {
  console.error(`[FAIL] ${message}`)
  process.exit(1)
}
