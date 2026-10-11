/**
 * What a profile is made of, read out of a JSON:API user.
 *
 * No Vue and no DOM in here, so the reading can be tested on its own and a
 * site can use it without a component.
 */

/**
 * The name to show, as Drupal renders it.
 *
 * `display_name` is what Drupal calls a user, and a site that renames its
 * users has it there. `name` is the account name, and is what is left when
 * the reader may not see the rest.
 *
 * @param {object} user - A JSON:API user resource.
 * @returns {string} The name, or an empty string.
 */
export const nameOf = (user) => {
  const attributes = (user || {}).attributes || {}
  return attributes.display_name || attributes.name || ''
}

/**
 * The initials to fall back to, at most two.
 *
 * @param {string} name - A name.
 * @returns {string} One or two letters, upper case.
 */
export const initialsOf = (name) => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return ''
  const letters =
    words.length === 1
      ? [words[0][0]]
      : [words[0][0], words[words.length - 1][0]]
  return letters.join('').toUpperCase()
}

/**
 * The user's picture, from the file included with the user.
 *
 * Drupal gives the file its own resource, so the picture is only here when
 * the site asked for it to be included.
 *
 * @param {object} user - A JSON:API user resource.
 * @param {object[]} included - The resources included with it.
 * @param {string} [field] - The image field, `user_picture` by default.
 * @returns {string|null} The image URL, or null where there is none.
 */
export const pictureOf = (user, included = [], field = 'user_picture') => {
  const reference = (((user || {}).relationships || {})[field] || {}).data
  if (!reference || !reference.id) return null
  const file = (included || []).find(
    (resource) => (resource || {}).id === reference.id
  )
  const url =
    (((file || {}).attributes || {}).uri || {}).url ||
    ((file || {}).attributes || {}).url
  return url || null
}

/**
 * The user's roles, with the labels Drupal gave them.
 *
 * A role is a configuration entity, so its label is only here when the site
 * asked for the roles to be included. The machine name is always there.
 *
 * @param {object} user - A JSON:API user resource.
 * @param {object[]} included - The resources included with it.
 * @returns {Array<{id: string, label: string}>} The roles, in Drupal's order.
 */
export const rolesOf = (user, included = []) => {
  const references = (((user || {}).relationships || {}).roles || {}).data || []
  return references.filter(Boolean).map((reference) => {
    const role = (included || []).find(
      (resource) => (resource || {}).id === reference.id
    )
    const attributes = (role || {}).attributes || {}
    return {
      id: attributes.drupal_internal__id || reference.id,
      label: attributes.label || attributes.drupal_internal__id || reference.id,
    }
  })
}

/**
 * When the account was created, where the reader may see it.
 *
 * @param {object} user - A JSON:API user resource.
 * @returns {string|null} An ISO 8601 date, or null.
 */
export const sinceOf = (user) => ((user || {}).attributes || {}).created || null

/** Gravatar's address for a hashed email. */
const GRAVATAR = 'https://gravatar.com/avatar'

/**
 * The gravatar for a hashed email.
 *
 * `d=404` rather than an image, so a reader with no gravatar falls back to
 * whatever the site draws instead of to a stranger's silhouette.
 *
 * @param {string} hash - The hash from emailHash().
 * @param {object} [options] - Options.
 * @param {number} [options.size] - The size in pixels.
 * @param {string} [options.fallback] - Gravatar's `d` parameter.
 * @returns {string|null} The URL, or null without a hash.
 */
export const gravatarUrl = (hash, { size = 96, fallback = '404' } = {}) =>
  hash ? `${GRAVATAR}/${hash}?s=${size}&d=${fallback}` : null

/**
 * Gravatar's hash of an email address: SHA-256 of it, trimmed and lower case.
 *
 * The hashing is the platform's, passed in rather than imported, because a
 * browser and a server have it in different places and a module that reached
 * for one would break in the other.
 *
 * @param {string} email - The email address.
 * @param {SubtleCrypto} [subtle] - A Web Crypto implementation.
 * @returns {Promise<string|null>} The hash, or null where it cannot be made.
 */
export const emailHash = async (email, subtle) => {
  const address = String(email || '')
    .trim()
    .toLowerCase()
  if (
    !address ||
    !subtle ||
    !subtle.digest ||
    typeof TextEncoder === 'undefined'
  )
    return null
  const bytes = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(address)
  )
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
