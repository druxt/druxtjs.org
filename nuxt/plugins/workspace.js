import { applyWorkspace, hasBearer, readWorkspace } from '~/lib/workspace'

/**
 * A signed-in editor reads every page in the workspace they chose.
 *
 * The choice comes from a cookie, read from the request on the server render
 * and from the document in the browser, and goes to Drupal as a header on the
 * Druxt client's content requests that carry the editor's token. The client
 * is shared with the auth module, so its requests are covered on both sides.
 * Readers' requests have no token, so never carry it.
 *
 * @param {object} context - The Nuxt context.
 * @param {object} context.app - The root Vue app options, carrying $druxt and $auth.
 * @param {object} context.store - The Vuex store.
 * @param {object} [context.req] - The request, on the server.
 */
export default ({ app, store, req }) => {
  const cookies = process.server ? ((req || {}).headers || {}).cookie : document.cookie
  store.commit('setEditorWorkspace', readWorkspace(cookies))

  app.$druxt.axios.interceptors.request.use((config) => {
    // The auth module adds the token in an interceptor of its own that runs
    // after this one, so a page's first requests, such as a preview's, hold
    // it in the strategy and not yet in the headers.
    const strategy = (app.$auth || {}).strategy || {}
    config.headers = applyWorkspace(config.headers || {}, {
      // The token, not loggedIn: a server render sends it before it says so.
      signedIn: hasBearer(config.headers) || Boolean(strategy.token && strategy.token.get()),
      workspace: store.state.editor.workspace,
      url: config.url,
      baseURL: config.baseURL,
    })
    return config
  })
}
