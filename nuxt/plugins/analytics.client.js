import { GA_MEASUREMENT_ID, optOutEditors } from '~/lib/analytics'

/**
 * `$track(name, params)` - the docs site's only GA4 event entry point.
 *
 * Dispatches through the global `gtag()` from the inline snippet in
 * nuxt.config.js; a direct `window.dataLayer` push is ignored by gtag.js. The
 * snippet is production-only, so this is a no-op in dev and on previews.
 *
 * A signed-in editor is working on the site, so that browser stops sending hits.
 *
 * @param {object} context - The Nuxt context.
 * @param {Function} inject - Nuxt's injector, used to expose `$track`.
 */
export default ({ app }, inject) => {
  // Once every plugin has run, since the auth plugin runs after this one.
  if (typeof window !== 'undefined') {
    window.onNuxtReady(() => optOutEditors(app.$auth, window, GA_MEASUREMENT_ID))
  }

  inject('track', (name, params = {}) => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
    try {
      window.gtag('event', name, params)
    } catch (e) {
      // Analytics must never break the interaction it is measuring.
    }
  })
}
