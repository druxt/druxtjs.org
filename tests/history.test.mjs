// Unit tests for what the documentation's git history gives each page: its
// dates, and the versions it has had.
//
//   node --test "tests/*.test.mjs"

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { dates, isoDate, parseLog, versions } from '../scripts/lib/history.mjs'

const sha = (digit) => digit.repeat(40)

/** What `git log --format=LOG_FORMAT --name-only` prints, newest first. */
const gitLog = (...commits) =>
  commits
    .map(([hash, seconds, subject, file]) => `\x1e${hash}\x1f${seconds}\x1f${subject}\n\n${file}\n`)
    .join('')

describe('isoDate', () => {
  test('writes UTC with an offset, the form the migration parses', () => {
    assert.equal(isoDate('1667435566'), '2022-11-03T00:32:46+00:00')
  })

  test('keeps the exact second', () => {
    assert.equal(Date.parse(isoDate('1612141200')) / 1000, 1612141200)
  })

  test('refuses a value git did not give as seconds', () => {
    assert.throws(() => isoDate('2022-11-03T00:32:46Z'), RangeError)
  })
})

describe('parseLog', () => {
  test('reads each commit, newest first, with the path the page had then', () => {
    const commits = parseLog(
      gitLog(
        [
          sha('b'),
          '1667435566',
          'chore(docs): add devtools guide page',
          'docs/nuxt/content/guide/proxy.md',
        ],
        [
          sha('a'),
          '1636498122',
          'feat(#362): add Proxy support (#364)',
          'docs/content/guide/proxy.md',
        ]
      )
    )
    assert.deepEqual(commits, [
      {
        sha: sha('b'),
        date: '2022-11-03T00:32:46+00:00',
        subject: 'chore(docs): add devtools guide page',
        path: 'docs/nuxt/content/guide/proxy.md',
      },
      {
        sha: sha('a'),
        date: '2021-11-09T22:48:42+00:00',
        subject: 'feat(#362): add Proxy support (#364)',
        path: 'docs/content/guide/proxy.md',
      },
    ])
  })

  test('a subject that reads like a path is still the subject', () => {
    const [commit] = parseLog(
      gitLog([sha('c'), '1612141200', 'docs/guide/client.md: fix a typo', 'docs/guide/client.md'])
    )
    assert.equal(commit.subject, 'docs/guide/client.md: fix a typo')
    assert.equal(commit.path, 'docs/guide/client.md')
  })

  test('refuses an entry it cannot read rather than skipping it', () => {
    assert.throws(
      () => parseLog('\x1enot-a-sha\x1f1612141200\x1fsubject\n\nfile.md\n'),
      /Unreadable git log entry/
    )
    assert.throws(
      () => parseLog(`\x1e${sha('d')}\x1f1612141200\x1fsubject\n`),
      /Unreadable git log entry/
    )
  })
})

describe('dates', () => {
  test('written at the oldest commit, changed at the newest, which the page is dated to', () => {
    const commits = parseLog(
      gitLog(
        [
          sha('b'),
          '1667435566',
          'chore(docs): add devtools guide page',
          'docs/nuxt/content/guide/proxy.md',
        ],
        [
          sha('a'),
          '1636498122',
          'feat(#362): add Proxy support (#364)',
          'docs/content/guide/proxy.md',
        ]
      )
    )
    assert.deepEqual(dates(commits), {
      created: '2021-11-09T22:48:42+00:00',
      changed: '2022-11-03T00:32:46+00:00',
      origin: 'docs/content/guide/proxy.md',
      commit: { sha: sha('b'), subject: 'chore(docs): add devtools guide page' },
    })
  })
})

describe('versions', () => {
  // The proxy guide's history at the pin, reduced: written, changed, moved
  // without a change, changed back to exactly how it was written, changed.
  const commits = [
    { sha: sha('5'), subject: 'rewrite', path: 'how-to/proxy.md' },
    { sha: sha('4'), subject: 'change back', path: 'how-to/proxy.md' },
    { sha: sha('3'), subject: 'move', path: 'how-to/proxy.md' },
    { sha: sha('2'), subject: 'change', path: 'guide/proxy.md' },
    { sha: sha('1'), subject: 'write', path: 'guide/proxy.md' },
  ]
  const contents = {
    [sha('1')]: 'A',
    [sha('2')]: 'B',
    [sha('3')]: 'B',
    [sha('4')]: 'A',
    [sha('5')]: 'C',
  }
  const read = (commit) => contents[commit.sha]

  test('oldest first, each with its commit and the path it had then', () => {
    const [first, second] = versions(commits, read)
    assert.deepEqual(first, { ...commits[4], content: 'A' })
    assert.equal(second.path, 'guide/proxy.md')
  })

  test('a commit that leaves the page as it was is not a version', () => {
    assert.deepEqual(
      versions(commits, read).map((version) => version.subject),
      ['write', 'change', 'change back', 'rewrite']
    )
  })

  test('a page that changes back is a new version, because it changed', () => {
    assert.deepEqual(
      versions(commits, read).map((version) => version.content),
      ['A', 'B', 'A', 'C']
    )
  })

  test('a commit at which the page does not exist is skipped', () => {
    const removed = { ...contents, [sha('4')]: null }
    assert.deepEqual(
      versions(commits, (commit) => removed[commit.sha]).map((version) => version.content),
      ['A', 'B', 'C']
    )
  })
})
