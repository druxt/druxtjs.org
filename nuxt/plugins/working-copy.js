import { withWorkingCopy } from '~/lib/working-copy'

/**
 * A signed-in editor reads pages and paragraphs as their working copy, so a
 * draft shows at the page's own URL. Every fetch goes through the one Druxt
 * client, and every request through its URL builder, on the server and in
 * the browser alike. Anonymous requests are left as they are.
 *
 * @param {object} context - The Nuxt context.
 * @param {object} context.app - The root Vue app options, carrying $druxt and $auth.
 */
export default ({ app }) => {
  const build = app.$druxt.buildQueryUrl.bind(app.$druxt)
  app.$druxt.buildQueryUrl = (url, query) => {
    const built = build(url, query)
    return app.$auth && app.$auth.loggedIn ? withWorkingCopy(built) : built
  }
}
