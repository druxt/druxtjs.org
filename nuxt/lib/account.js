/**
 * The signed-in account, as the header and the sign-in dialog show it.
 *
 * Plain CommonJS, so the tests import it without the app.
 */

/** The roles worth naming, most privileged first. */
const ROLES = [
  ['administrator', 'Admin'],
  ['editor', 'Editor'],
  ['contributor', 'Contributor'],
]

/**
 * Up to two initials: the first and last words of the display name.
 *
 * @param {string} [name] - The display name.
 * @returns {string} The initials, or `?` without a name.
 */
const initials = (name) => {
  const words = String(name || '').trim().split(/[\s._-]+/).filter(Boolean)
  if (!words.length) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/**
 * Which of the three brand hues an account's initials sit on. From the user
 * id, so a person keeps their colour.
 *
 * @param {string|number} [sub] - The user id.
 * @returns {number} 0, 1 or 2.
 */
const hueOf = (sub) => {
  const id = parseInt(sub, 10)
  return Number.isFinite(id) ? Math.abs(id) % 3 : 0
}

/**
 * The account's most privileged role, labelled.
 *
 * @param {string[]} [roles] - The `roles` claim.
 * @returns {string|null} The label, or null for none worth naming.
 */
const roleLabel = (roles) => {
  const held = Array.isArray(roles) ? roles : []
  const match = ROLES.find(([id]) => held.includes(id))
  return match ? match[1] : null
}

/**
 * A URL made relative, so it is fetched from this origin, whose proxy serves
 * Drupal's files. Drupal builds it on whichever host it was asked on, which
 * behind the proxy can be its own.
 *
 * @param {string} [url] - An absolute or relative URL.
 * @returns {string|null} The path and query, or null.
 */
const sameOrigin = (url) => {
  if (!url) return null
  try {
    const parsed = new URL(url, 'http://relative')
    return parsed.pathname + parsed.search
  } catch (e) {
    return null
  }
}

/**
 * The account as the menu shows it, from the userinfo claims.
 *
 * @param {object} [user] - `$auth.user`.
 * @returns {{ name: string, username: string|null, picture: string|null, initials: string, hue: number, role: string|null, id: string|null }} The account.
 */
const accountOf = (user) => {
  const claims = user || {}
  const name = claims.name || claims.preferred_username || claims.email || 'Signed in'
  return {
    id: claims.sub ? String(claims.sub) : null,
    name,
    username: claims.preferred_username || null,
    picture: sameOrigin(claims.picture),
    initials: initials(name),
    hue: hueOf(claims.sub),
    role: roleLabel(claims.roles),
  }
}

/**
 * What to tell someone whose sign-in Drupal refused.
 *
 * Drupal answers a wrong name or password with 400, and a blocked or
 * flood-limited account with 403. Neither says which half was wrong, and
 * neither does this.
 *
 * @param {number} status - The HTTP status.
 * @param {string} [message] - Drupal's own message.
 * @returns {string} The message.
 */
const signInError = (status, message) => {
  const text = String(message || '')
  if (status === 400) return "That username and password don't match an account."
  if (/too many|temporarily blocked/i.test(text)) return 'Too many failed attempts. Try again later.'
  if (/not been activated|is blocked/i.test(text)) return "This account can't sign in. Ask an administrator."
  if (status >= 500 || !status) return "The site couldn't be reached. Try again in a moment."
  return text || "Sign-in didn't work. Try again."
}

module.exports = {
  ROLES,
  accountOf,
  hueOf,
  initials,
  roleLabel,
  sameOrigin,
  signInError,
}
