import { PREVIEW_INCLUDE, previewRequest } from '~/lib/node-preview'

/**
 * A node preview reads in the editor's workspace.
 *
 * Runs after the vendored preview module's plugin and replaces its fetch
 * with one that carries the workspace header, so an editor previewing in a
 * workspace sees that workspace's paragraphs and media rather than live's.
 *
 * Temporary. The module is moving its fetch onto the Druxt client, where the
 * site's workspace interceptor already applies; this plugin and
 * lib/node-preview.js go when that release is vendored.
 *
 * @param {object} context - The Nuxt context.
 * @param {object} context.app - The root Vue app options, carrying $druxtNodePreview.
 * @param {object} context.store - The Vuex store.
 */
export default ({ app, store }) => {
  const preview = app.$druxtNodePreview
  if (!preview) return
  preview.fetch = async (endpoint) => {
    const { url, init } = previewRequest(endpoint, {
      include: PREVIEW_INCLUDE,
      workspace: store.state.editor.workspace,
    })
    const response = await window.fetch(url, init)
    if (!response.ok) {
      const body = (await response.text().catch(() => '')).slice(0, 300)
      throw new Error('Preview request failed with HTTP ' + response.status + ' for ' + url + (body ? ': ' + body : ''))
    }
    return response.json()
  }
}
