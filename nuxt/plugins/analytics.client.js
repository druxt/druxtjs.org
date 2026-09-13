/**
 * `$track(name, params)` - the docs site's only GA4 event entry point.
 *
 * Dispatches through the global `gtag()` from the inline snippet in
 * nuxt.config.js; a direct `window.dataLayer` push is ignored by gtag.js. The
 * snippet is production-only, so this is a no-op in dev and on previews.
 *
 * @param {object} context - The Nuxt context (unused; required by the signature).
 * @param {Function} inject - Nuxt's injector, used to expose `$track`.
 */
export default (context, inject) => {
  inject('track', (name, params = {}) => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
    try {
      window.gtag('event', name, params)
    } catch (e) {
      // Analytics must never break the interaction it is measuring.
    }
  })
}
