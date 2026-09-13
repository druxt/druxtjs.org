// A page's earlier versions, in the form the IR carries them for the
// importer to save as revisions. Needs nothing from node_modules, so its
// unit tests run without an install.

import { Defects, buildBlocks, normalise, serialise } from './blocks.mjs'
import { splitFrontmatter, tokenize } from './corpus.mjs'

/**
 * The title a version had.
 *
 * Its frontmatter's when it has one. The earliest pages had no frontmatter
 * and opened with a level-one heading, the title in the body itself, so that
 * is next. A version with neither takes the title of the version after it.
 *
 * @param {object} frontmatter - The version's frontmatter.
 * @param {object[]} tokens - Its tokenized blocks.
 * @param {string} next - The title of the version after it.
 * @returns {string} The title.
 */
function titleOf(frontmatter, tokens, next) {
  if (frontmatter.title) return frontmatter.title
  for (const token of tokens) {
    if (token.kind === 'fence') continue
    for (const line of token.lines) {
      const match = /^#\s+(.+?)\s*$/.exec(line)
      if (match) return match[1]
    }
  }
  return next
}

/**
 * Whether a version's blocks rebuild the markdown they were parsed from.
 *
 * One step wider than the current corpus is held to, and no wider: blank
 * lines are ignored. An earlier version sometimes put a fence directly under
 * a line of prose, and the blocks rebuild it with the blank line the current
 * corpus always has between them. Every other line has to come back, in
 * order and unchanged.
 *
 * @param {string} body - The version's body.
 * @param {object[]} blocks - Its IR blocks.
 * @param {object[]} presentation - Its wrappers.
 * @returns {boolean} True when nothing was lost or changed.
 */
export function rebuilds(body, blocks, presentation) {
  const lines = (markdown) => normalise(markdown).replace(/\n{2,}/g, '\n')
  return lines(serialise(blocks, presentation)) === lines(body)
}

/**
 * One earlier version of a page, as the IR carries it.
 *
 * Parsed by the code that parses the current version, so a revision holds
 * the blocks today's parser finds in that commit. What differs is what a
 * defect costs. The current version is what the site serves, so it has to
 * meet the model or the build stops. An earlier version happened and cannot
 * be edited, so nothing in it stops the build:
 *
 * - A fence the model refuses, such as one in a language outside its set, is
 *   kept verbatim in the prose around it rather than dropped.
 * - An image stays an image only when the current corpus migrates the same
 *   file with the same alt text, so its paragraph can point at today's media
 *   and still say what the page said. Any other image, whether its file is
 *   gone or its alt text has since changed, stays in the prose as the
 *   markdown it was, and no media is made for it.
 * - Links are not checked. A page that linked somewhere since moved did link
 *   there.
 *
 * @param {object} version - `{sha, date, subject, path, content}`.
 * @param {Map<string, string>} images - Path to alt text, for every image
 *   the current corpus migrates.
 * @param {string} next - The title of the version after this one.
 * @returns {{revision: object, notes: object[], rebuilds: boolean}} The IR
 *   entry, what was kept as prose and why, and whether its blocks rebuild
 *   the version.
 */
export function revision(version, images, next) {
  const { frontmatter, body } = splitFrontmatter(version.content)
  const tokens = tokenize(body).blocks
  const notes = new Defects()
  const file = `${version.path}@${version.sha.slice(0, 12)}`
  const { blocks, presentation } = buildBlocks({ file, blocks: tokens }, notes, { keepRefused: true, images })
  return {
    revision: {
      sha: version.sha,
      date: version.date,
      subject: version.subject,
      path: version.path,
      title: titleOf(frontmatter, tokens, next),
      description: frontmatter.description ?? null,
      blocks,
    },
    notes: notes.items,
    rebuilds: rebuilds(body, blocks, presentation),
  }
}

/**
 * Every earlier version of a page, oldest first.
 *
 * Built newest first, so that a version with no title of its own can take
 * the one after it, which ends at the current page's.
 *
 * @param {object[]} earlier - Versions before the current one, oldest first.
 * @param {Map<string, string>} images - As for revision().
 * @param {string} title - The current page's title.
 * @returns {object[]} What revision() returns for each, oldest first.
 */
export function revisions(earlier, images, title) {
  const built = []
  let next = title
  for (const version of [...earlier].reverse()) {
    const entry = revision(version, images, next)
    next = entry.revision.title
    built.unshift(entry)
  }
  return built
}
