/**
 * Bridges `$colorMode.value` to the `data-theme` attribute daisyUI reads: the
 * Nuxt 2 release of @nuxtjs/color-mode only toggles a CSS class.
 *
 * The inline script in nuxt.config.js sets the attribute before first paint;
 * this keeps it in sync after that.
 */
export default ({ app }) => {
  window.onNuxtReady(() => {
    const apply = (value) => {
      document.documentElement.setAttribute('data-theme', value)
    }

    apply(app.$colorMode.value)
    app.$colorMode.$watch('value', apply)
  })
}
