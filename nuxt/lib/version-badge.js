/**
 * The version badge in the header and footer.
 *
 * A development build's version carries its build time, `0.25.0-dev.20261007123456`,
 * which breaks the badge's pill at tablet widths. The badge names the tag alone and
 * keeps the full version, with the build time, in its title.
 */

/**
 * The badge text for a version.
 *
 * @param {string|null|undefined} version - The pinned druxt version, without a `v`.
 * @returns {string|null} `v0.25.0-dev` for a development build, `v0.24.0` for a release, null for none.
 */
const badgeOf = (version) => (version ? 'v' + String(version).replace(/-dev\.\d+$/, '-dev') : null)

/**
 * The badge's title, the whole version.
 *
 * @param {string|null|undefined} version - The pinned druxt version, without a `v`.
 * @returns {string|null} `v` and the version as given, or null for none.
 */
const titleOf = (version) => (version ? 'v' + String(version) : null)

module.exports = { badgeOf, titleOf }
