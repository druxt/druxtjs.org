/**
 * The header and footer badge for the installed `druxt` version.
 *
 * A development snapshot's version ends in its build time, which does not fit
 * the header. The badge keeps `-dev`, and the title keeps the build.
 */

const SNAPSHOT = /^(\d+\.\d+\.\d+-dev)\.(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\d{2}$/
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * The badge for a version.
 *
 * @param {string} [version] - The installed version, such as `0.25.0-dev.20260921034536`.
 * @returns {{ label: string, title: string }|null} The badge, or null without a version.
 */
const versionBadge = (version) => {
  if (!version) return null
  const snapshot = SNAPSHOT.exec(version)
  if (!snapshot) return { label: `v${version}`, title: `Druxt ${version} release notes` }
  const [, base, year, month, day, hour, minute] = snapshot
  const built = `${Number(day)} ${MONTHS[Number(month) - 1]} ${year} ${hour}:${minute} UTC`
  return { label: `v${base}`, title: `Druxt ${version}, built ${built}: release notes` }
}

module.exports = { versionBadge }
