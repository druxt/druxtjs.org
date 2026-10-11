// What the prose checks read of a merge request description. A review bot
// writes its summary into the description, and that text is nobody's to answer
// for, so it is dropped. The description is the author's own text, though, so
// a marker that never closes must not take the rest of the checks with it.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const program = path.join(here, '..', '.gitlab', 'scripts', 'strip-generated.awk')

/** The description as the linter sees it. */
const strip = (text) => execFileSync('awk', ['-f', program], { input: text, encoding: 'utf8' })

const OPEN = '<!-- This is an auto-generated comment: summarize by coderabbit.ai -->'
const SHORT = '<!-- auto-generated comment -->'
const CLOSE = '<!-- end of auto-generated comment -->'

describe('stripping a review bot summary', () => {
  test('keeps a description that has none', () => {
    const body = 'Adds the editor bar.\n\nIt reads the page anchors.\n'
    assert.equal(strip(body), body)
  })

  test('drops a closed block, and keeps what surrounds it', () => {
    const body = `Before.\n${OPEN}\nSummary by CodeRabbit\n${CLOSE}\nAfter.\n`
    assert.equal(strip(body), 'Before.\nAfter.\n')
  })

  test('drops each of several blocks', () => {
    const body = `A.\n${OPEN}\none\n${CLOSE}\nB.\n${SHORT}\ntwo\n${CLOSE}\nC.\n`
    assert.equal(strip(body), 'A.\nB.\nC.\n')
  })

  // The hole this closes: an opening marker with no end set the skip for the
  // rest of the file, so no later line was ever checked. An author writes the
  // description, so that turned the prose gate off for anyone who pasted one.
  test('keeps everything after a marker that never closes', () => {
    const body = `Before.\n${OPEN}\nThis text is the author's after all.\nSo is this.\n`
    const out = strip(body)
    assert.match(out, /Before\./)
    assert.match(out, /This text is the author's after all\./)
    assert.match(out, /So is this\./)
    assert.equal(out, body, 'nothing was a block, so nothing is dropped')
  })

  test('an unclosed marker after a closed block still holds nothing back', () => {
    const body = `A.\n${OPEN}\ndropped\n${CLOSE}\nB.\n${OPEN}\nkept.\n`
    const out = strip(body)
    assert.doesNotMatch(out, /dropped/)
    assert.match(out, /A\.\nB\.\n/)
    assert.match(out, /kept\./)
  })

  test('a close with no open is text like any other', () => {
    const body = `A.\n${CLOSE}\nB.\n`
    assert.equal(strip(body), body)
  })
})
