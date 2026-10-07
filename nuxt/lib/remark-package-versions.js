/**
 * Package versions in the generated release notes, kept out of mailto links.
 *
 * changesets writes `druxt@0.24.0` for a dependency a release took, and GFM
 * reads anything with an `@` and a dotted tail as an email address. The
 * changelog pages rendered every one as a mailto link. A link whose address
 * ends in a version is a package, and is shown as code instead.
 */

/** An address whose host is a version: `name@1.2.3`, or a snapshot of one. */
const PACKAGE_VERSION = /^[^@\s/]+@\d+\.\d+\.\d+(?:[-+.][\w.]+)?$/

/**
 * Whether a link is a package version GFM mistook for an email address.
 *
 * @param {object} node - An mdast node.
 * @returns {boolean} True for a mailto link to a package version.
 */
const isPackageVersion = (node) =>
  node.type === 'link' &&
  String(node.url || '').startsWith('mailto:') &&
  PACKAGE_VERSION.test(node.url.slice('mailto:'.length))

/**
 * Replaces every such link in a tree with inline code naming the package.
 *
 * @param {object} tree - An mdast tree, changed in place.
 * @returns {object} The same tree.
 */
const fixPackageVersions = (tree) => {
  if (!Array.isArray(tree.children)) return tree
  tree.children = tree.children.map((child) =>
    isPackageVersion(child)
      ? { type: 'inlineCode', value: child.url.slice('mailto:'.length) }
      : fixPackageVersions(child)
  )
  return tree
}

/** The remark plugin: a transformer over the parsed tree. */
const remarkPackageVersions = () => fixPackageVersions

module.exports = remarkPackageVersions
module.exports.fixPackageVersions = fixPackageVersions
module.exports.isPackageVersion = isPackageVersion
