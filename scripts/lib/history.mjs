// Page dates and earlier versions from the documentation's git history.
// Needs nothing from node_modules, so its unit tests run without an install.

import { execFileSync } from 'node:child_process'

/**
 * Git renders UTC as `Z` or `+00:00` depending on its version, so dates are
 * read as epoch seconds and written in the one form the migration parses.
 */
export function isoDate(seconds) {
  return new Date(Number(seconds) * 1000).toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

/**
 * What log() asks git for: each commit's sha, author date in epoch seconds
 * and subject, behind a record separator so no subject can be read as a
 * path. `--name-only` then gives the path the page had at that commit.
 */
export const LOG_FORMAT = '%x1e%H%x1f%at%x1f%s'

/**
 * Reads `git log --format=LOG_FORMAT --name-only` output for one page.
 *
 * @param {string} output - What git printed.
 * @returns {object[]} `{sha, date, subject, path}` per commit, newest first
 *   as git lists them. `path` is where the page was at that commit, which is
 *   where its contents are found after a move.
 */
export function parseLog(output) {
  return output.split('\x1e').filter((record) => record.trim()).map((record) => {
    const [head, ...names] = record.split('\n')
    const [sha, seconds, subject = ''] = head.split('\x1f')
    const file = names.find((name) => name.trim())
    if (!/^[0-9a-f]{40}$/.test(sha) || !/^\d+$/.test(seconds ?? '') || !file) {
      throw new Error(`Unreadable git log entry: ${JSON.stringify(record.slice(0, 120))}`)
    }
    return { sha, date: isoDate(seconds), subject, path: file }
  })
}

/**
 * Every commit that touched a page, newest first.
 *
 * `--follow` with a 30% rename threshold carries a page back through a move
 * or a heavy rewrite, which is how the older pages survived the Diataxis
 * rebuild.
 */
export function log(root, file) {
  const output = execFileSync(
    'git',
    ['-C', root, 'log', '--follow', '-M30%', `--format=${LOG_FORMAT}`, '--name-only', 'HEAD', '--', file],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const commits = parseLog(output)
  if (!commits.length) throw new Error(`${file}: no history at HEAD`)
  return commits
}

/**
 * When a page was written and last changed, and the commit that last
 * changed it, which the current version is dated to.
 *
 * `origin` is the path the oldest commit knew the page by, so a link someone
 * disagrees with can be seen rather than inferred.
 *
 * @param {object[]} commits - From log(), newest first.
 */
export function dates(commits) {
  const newest = commits[0]
  const oldest = commits[commits.length - 1]
  return {
    created: oldest.date,
    changed: newest.date,
    origin: oldest.path,
    commit: { sha: newest.sha, subject: newest.subject },
  }
}

/**
 * A page's contents at one commit, or null when that commit removed it.
 */
export function contentAt(root, commit) {
  const spec = `${commit.sha}:${commit.path}`
  try {
    execFileSync('git', ['-C', root, 'cat-file', '-e', spec], { stdio: 'ignore' })
  }
  catch {
    return null
  }
  return execFileSync('git', ['-C', root, 'cat-file', 'blob', spec], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/**
 * The distinct versions of a page, oldest first.
 *
 * A commit that leaves the page exactly as the version before it, such as a
 * move, is not a version of its own. A page that changes and later changes
 * back is three versions, because that is what happened. A commit at which
 * the page does not exist, between a removal and a restore, is skipped.
 *
 * @param {object[]} commits - From log(), newest first.
 * @param {function(object): (string|null)} read - The page at a commit.
 * @returns {object[]} `{sha, date, subject, path, content}`, oldest first.
 */
export function versions(commits, read) {
  const kept = []
  for (const commit of [...commits].reverse()) {
    const content = read(commit)
    if (content === null || content === kept.at(-1)?.content) continue
    kept.push({ ...commit, content })
  }
  return kept
}

/**
 * A shallow checkout has no history before its boundary, so every page would
 * be dated to the fetch rather than to when it was written, with no error.
 */
export function assertFullHistory(root) {
  const shallow = execFileSync('git', ['-C', root, 'rev-parse', '--is-shallow-repository'], { encoding: 'utf8' }).trim()
  if (shallow === 'true') {
    throw new Error(`${root} is a shallow clone. Page dates come from git history, so it needs the full history: fetch without --depth.`)
  }
}
