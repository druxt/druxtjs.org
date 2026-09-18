import { applyVersion } from '~/lib/working-copy'

/**
 * A signed-in editor reads the page at the revision the toolbar selects, so a
 * draft or an older revision shows at the page's own URL. Every page fetch
 * goes through the one Druxt client and its URL builder, on the server and in
 * the browser alike. Anonymous requests are left as they are.
 *
 * @param {object} context - The Nuxt context.
 * @param {object} context.app - The root Vue app options, carrying $druxt and $auth.
 * @param {object} context.store - The Vuex store.
 */
export default ({ app, store }) => {
  const build = app.$druxt.buildQueryUrl.bind(app.$druxt)
  app.$druxt.buildQueryUrl = (url, query) => {
    const built = build(url, query)
    if (!(app.$auth && app.$auth.loggedIn)) return built
    return applyVersion(built, store.state.editor.version)
  }
}
