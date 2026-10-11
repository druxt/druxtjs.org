import { applyWorkspace, hasBearer, readWorkspace } from '~/lib/workspace'
import { hasPreviewCookie } from '~/lib/workspace-preview'

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
  // The preview cookie is HttpOnly: the server render reads it and the
  // browser keeps what the server said.
  if (process.server) store.commit('setWorkspacePreview', hasPreviewCookie(cookies))

  app.$druxt.axios.interceptors.request.use((config) => {
    config.headers = applyWorkspace(config.headers || {}, {
      // The token, not loggedIn: a server render sends it before it says so.
      signedIn: hasBearer(config.headers),
      workspace: store.state.editor.workspace,
      url: config.url,
      baseURL: config.baseURL,
    })
    return config
  })
}
