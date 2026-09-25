/**
 * Finding a diff's block among the elements a page rendered.
 *
 * A block has a uuid on each side, and which side a page renders is not
 * always the one asked for: a page whose body is the live content still has
 * a diff against a revision, and its elements carry the left uuid. So a
 * lookup that insists on one side finds nothing on half the pages.
 *
 * ES modules, because the package this reads from is one.
 */

import { anchorUuid } from '@druxt-contrib/diff'

/**
 * Both uuids a block may be rendered under, the rendered side first.
 *
 * @param {object} block - A block from normaliseDiff().
 * @returns {string[]} The uuids to look for.
 */
export const anchorsOf = (block) => {
  const right = anchorUuid(block, 'right')
  const left = anchorUuid(block, 'left')
  return [right, left].filter((uuid, index, all) => uuid && all.indexOf(uuid) === index)
}

/**
 * The block an element stands for, whichever side the page rendered.
 *
 * @param {object[]} blocks - The blocks from normaliseDiff().
 * @param {string} uuid - The uuid the page rendered.
 * @param {string} [status] - Only match a block with this status.
 * @returns {object|null} The block, or null.
 */
export const blockFor = (blocks, uuid, status) => {
  if (!uuid) return null
  return (
    (blocks || []).find(
      (block) => anchorsOf(block).includes(uuid) && (!status || block.status === status)
    ) || null
  )
}
