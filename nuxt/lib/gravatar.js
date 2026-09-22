/**
 * Gravatar, as a fallback for an account with no picture in Drupal.
 *
 * Gravatar keys an avatar on a hash of the address, so nothing but the hash
 * leaves the browser, and `d=404` means an address with no Gravatar answers
 * 404 rather than a generated image: the avatar then falls back to initials.
 *
 * Browser only, and only where the page is on HTTPS or localhost:
 * `crypto.subtle` exists nowhere else, so a site served over plain HTTP
 * simply keeps the initials.
 *
 * Plain CommonJS, so the tests import it without the app.
 */

/** Gravatar's own host for avatar requests. */
const HOST = 'https://gravatar.com/avatar'

/**
 * The address as Gravatar hashes it: trimmed, lower case.
 *
 * @param {string} [email] - The address.
 * @returns {string} The normalised address.
 */
const normalise = (email) => String(email || '').trim().toLowerCase()

/**
 * The avatar URL for a hashed address.
 *
 * @param {string} hash - The SHA-256 of the normalised address, in hex.
 * @param {number} [size] - The size in pixels, for the image Gravatar returns.
 * @returns {string} The URL.
 */
const gravatarUrl = (hash, size = 80) => `${HOST}/${hash}?s=${size}&d=404`

/**
 * The SHA-256 of an address, in hex, or null where the browser cannot hash.
 *
 * @param {string} email - The address.
 * @param {object|null} [subtle] - `crypto.subtle`, for the tests; null for a browser without it.
 * @returns {Promise<string|null>} The hash.
 */
const emailHash = async (email, subtle) => {
  const address = normalise(email)
  // Passed explicitly by the tests, including as null for a browser without it.
  const digest = subtle === undefined ? typeof crypto !== 'undefined' && crypto.subtle : subtle
  if (!address || !digest) return null
  try {
    const bytes = new TextEncoder().encode(address)
    const buffer = await digest.digest('SHA-256', bytes)
    return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  } catch (e) {
    return null
  }
}

module.exports = { HOST, emailHash, gravatarUrl, normalise }
