/**
 * Whether a link leaves the site: it names a scheme or a host, so the router
 * cannot take it.
 *
 * @param {string} url - The link's destination.
 * @returns {boolean}
 */
export const isExternal = (url) => /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(String(url || ''))
