/**
 * The profile pages this site renders itself.
 *
 * `/user` is proxied to Drupal whole, because a login form that posts to
 * another origin sets its cookie there, which is the problem the proxy
 * exists to solve. A profile sits inside that path, so it has to be named as
 * the exception: `/user/2` is this site's page, and everything else under
 * `/user` stays Drupal's, its forms included.
 */

/** A user's canonical path, which is the only one this site claims. */
const PROFILE_PATH = /^\/user\/\d+$/

/**
 * Whether a path is a profile this site renders.
 *
 * @param {string} path - A request path, with or without a query.
 * @returns {boolean} True for a profile page.
 */
const isProfilePath = (path) => PROFILE_PATH.test(String(path || '').split('?')[0])

module.exports = { PROFILE_PATH, isProfilePath }
