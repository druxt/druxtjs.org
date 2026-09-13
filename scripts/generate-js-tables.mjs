#!/usr/bin/env node
// Writes the tables the Drupal port of the table of contents reads, by
// measuring what github-slugger 1.5.0 and JavaScript do to every code point.
//
// Drupal computes field_toc on read, and every heading has to get the id the
// IR builder gives it: buildToc() in build-ir.mjs, which matches headings
// with a JavaScript regex and slugs them with github-slugger. Nothing below
// is transcribed from either. Each table is what Node answers when asked
// about each code point, so the port cannot misread a rule.
//
//   SLUG_REMOVE      what github-slugger's regex.js deletes
//   LOWERCASE        String.prototype.toLowerCase(), per code point
//   SIGMA_CASED      what counts as a letter, and what is skipped, when
//   SIGMA_IGNORABLE  toLowerCase() decides whether a capital sigma ends a word
//   WHITESPACE       \s, which is also what trim() removes
//   DOT              what . matches without the s flag
//
// toLowerCase() follows the Unicode version of the ICU Node is built with,
// and PHP's mb_strtolower() follows its own, so the two disagree about any
// letter one of them has not heard of yet. The table pins the port to the
// Node that generated it, and the output records which Node that was.
//
// Usage:
//   node scripts/generate-js-tables.mjs

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'drupal/web/modules/custom/druxt_docs/src/Toc/JsTables.php')

const SLUGGER_VERSION = require('github-slugger/package.json').version
const REMOVE = require('github-slugger/regex.js')

if (SLUGGER_VERSION !== '1.5.0') {
  process.stderr.write(`github-slugger ${SLUGGER_VERSION} is installed; the port is of 1.5.0.\n`)
  process.exit(1)
}

/** Every Unicode scalar value. Surrogates cannot occur in UTF-8 text. */
function* codePoints() {
  for (let cp = 0; cp <= 0x10ffff; cp += 1) {
    if (cp < 0xd800 || cp > 0xdfff) yield cp
  }
}

const hex = (cp) => cp.toString(16).toUpperCase()
const failures = []

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

const slugRemove = []
const lowercase = new Map()
const sigmaCased = []
const sigmaIgnorable = []
const whitespace = []
const dot = []

for (const cp of codePoints()) {
  const ch = String.fromCodePoint(cp)

  // regex.js has no u flag, so it sees an astral character as two code
  // units. A character it removed only half of would leave a lone
  // surrogate, which no per-character PHP class could reproduce.
  const removed = ch.replace(REMOVE, '')
  if (removed === '') slugRemove.push(cp)
  else if (removed !== ch) failures.push(`U+${hex(cp)}: regex.js removes part of it`)

  // Measured alone and after an uncased letter, which must agree: the only
  // context toLowerCase() reads is the one final sigma needs, below.
  const lower = ch.toLowerCase()
  if (lower !== ch) lowercase.set(cp, lower)
  if (`一${ch}`.toLowerCase().slice(1) !== lower)
    failures.push(`U+${hex(cp)}: lowercases differently in context`)

  // A capital sigma lowercases to final ς when a cased letter comes before
  // it and none after, skipping case-ignorable characters both ways. Each
  // character is placed on both sides of one to see which it is, and the
  // two answers have to agree.
  const before =
    (`${ch}Σ`.toLowerCase().at(-1) === 'ς' ? 'cased' : null) ??
    (`A${ch}Σ`.toLowerCase().at(-1) === 'ς' ? 'ignorable' : 'neither')
  const after =
    (`AΣ${ch}`.toLowerCase()[1] === 'σ' ? 'cased' : null) ??
    (`AΣ${ch}A`.toLowerCase()[1] === 'σ' ? 'ignorable' : 'neither')
  if (before !== after)
    failures.push(`U+${hex(cp)}: final sigma treats it as ${before} before and ${after} after`)
  if (before === 'cased') sigmaCased.push(cp)
  if (before === 'ignorable') sigmaIgnorable.push(cp)

  const isSpace = /^\s+$/.test(ch)
  if (isSpace) whitespace.push(cp)
  if ((ch.trim() === '') !== isSpace) failures.push(`U+${hex(cp)}: trim() and \\s disagree`)

  if (/^.+$/.test(ch)) dot.push(cp)
}

if (failures.length) {
  process.stderr.write(
    `${failures.join('\n')}\n\n${failures.length} code points cannot be tabulated; nothing written.\n`
  )
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Contiguous runs, never bridging the surrogate gap. */
function ranges(sorted) {
  const runs = []
  for (const cp of sorted) {
    const last = runs.at(-1)
    if (last && last[1] === cp - 1) last[1] = cp
    else runs.push([cp, cp])
  }
  return runs
}

const escape = (cp) => `\\x{${hex(cp)}}`
const runsToClass = (runs) =>
  runs.map(([a, b]) => (a === b ? escape(a) : `${escape(a)}-${escape(b)}`)).join('')

/** A PCRE class for a set of code points, negated when that is shorter. */
function pcreClass(set) {
  const members = new Set(set)
  const complement = [...codePoints()].filter((cp) => !members.has(cp))
  const positive = `[${runsToClass(ranges(set))}]`
  const negative = `[^${runsToClass(ranges(complement))}]`
  return positive.length <= negative.length ? positive : negative
}

/** A single-quoted PHP string, wrapped as a concatenation. */
function phpString(value, indent) {
  const width = 72
  const pieces = []
  for (let i = 0; i < value.length; i += width) {
    let end = Math.min(i + width, value.length)
    // Never split inside an \x{...} escape.
    const open = value.lastIndexOf('\\', end)
    if (open > i && !value.slice(open, end).includes('}') && end < value.length) end = open
    pieces.push(value.slice(i, end))
    i = end - width
  }
  return pieces.map((piece) => `'${piece}'`).join(`\n${indent}. `)
}

const phpChar = (text) => `"${[...text].map((c) => `\\u{${hex(c.codePointAt(0))}}`).join('')}"`

const lowercaseLines = []
const entries = [...lowercase].map(
  ([cp, lower]) => `${phpChar(String.fromCodePoint(cp))} => ${phpChar(lower)},`
)
for (let i = 0; i < entries.length; i += 3)
  lowercaseLines.push(`    ${entries.slice(i, i + 3).join(' ')}`)

const constant = (name, set) => `  public const ${name} = ${phpString(pcreClass(set), '    ')};`

const php = `<?php

// phpcs:ignoreFile

declare(strict_types=1);

namespace Drupal\\druxt_docs\\Toc;

/**
 * What github-slugger ${SLUGGER_VERSION} and JavaScript do to each code point.
 *
 * Generated by scripts/generate-js-tables.mjs, on Node ${process.version}
 * (ICU ${process.versions.icu}, Unicode ${process.versions.unicode}). Do not edit this file: change the
 * generator and run it again.
 */
final class JsTables {

  /**
   * The code points github-slugger's regex.js deletes, as a PCRE class.
   */
${constant('SLUG_REMOVE', slugRemove)}

  /**
   * String.prototype.toLowerCase(), for each code point it changes.
   *
   * Without context. The one mapping that reads context, capital sigma, is
   * decided with SIGMA_CASED and SIGMA_IGNORABLE.
   */
  public const LOWERCASE = [
${lowercaseLines.join('\n')}
  ];

  /**
   * Code points that count as cased when placing a final sigma.
   */
${constant('SIGMA_CASED', sigmaCased)}

  /**
   * Code points skipped when looking for a cased one either side of a sigma.
   */
${constant('SIGMA_IGNORABLE', sigmaIgnorable)}

  /**
   * JavaScript's \\s, which is also what String.prototype.trim() removes.
   */
${constant('WHITESPACE', whitespace)}

  /**
   * What JavaScript's . matches without the s flag.
   */
${constant('DOT', dot)}

}
`

mkdirSync(path.dirname(OUT), { recursive: true })
writeFileSync(OUT, php)
process.stdout.write(
  [
    `Wrote ${path.relative(ROOT, OUT)} on Node ${process.version} (Unicode ${process.versions.unicode}).`,
    `  SLUG_REMOVE      ${slugRemove.length} code points`,
    `  LOWERCASE        ${lowercase.size} code points`,
    `  SIGMA_CASED      ${sigmaCased.length} code points`,
    `  SIGMA_IGNORABLE  ${sigmaIgnorable.length} code points`,
    `  WHITESPACE       ${whitespace.length} code points`,
    `  DOT              ${dot.length} code points`,
    '',
  ].join('\n')
)
