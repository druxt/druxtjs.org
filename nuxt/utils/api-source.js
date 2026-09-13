/**
 * Where a generated API page's source lives in the druxt.js repository.
 *
 * docgen writes no source path into the page, so the URL is rebuilt from the
 * content path. Every package keeps its code under `src/`, which the content
 * tree leaves out: `api/packages/entity/components/DruxtField` comes from
 * `packages/entity/src/components/DruxtField.vue`.
 */

const REPO = 'https://github.com/druxt/druxt.js'
const BRANCH = 'develop'

/**
 * The GitHub URL for an API page's source file.
 *
 * @param {string} dir - The document's directory, e.g. '/api/packages/entity/components'.
 * @param {string} slug - The document's slug, e.g. 'DruxtField'.
 * @returns {?string} The URL, or null for a page with no single source file.
 */
export const apiSourceUrl = (dir, slug) => {
  if (!dir || !slug || !dir.startsWith('/api/packages/')) return null

  const [pkg, ...tail] = dir.replace('/api/packages/', '').split('/').filter(Boolean)
  if (!pkg) return null

  // The changelog is the one file that sits beside src/, not inside it.
  if (slug === 'CHANGELOG' && !tail.length) {
    return `${REPO}/blob/${BRANCH}/packages/${pkg}/CHANGELOG.md`
  }

  const extension = tail[0] === 'components' ? '.vue' : '.js'
  const file = [...tail, slug].join('/') + extension
  return `${REPO}/blob/${BRANCH}/packages/${pkg}/src/${file}`
}
