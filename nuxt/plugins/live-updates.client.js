import Vue from 'vue'
// By path: webpack 4 ignores the package's `exports` map.
import { affected } from '@druxt-contrib/sockets/dist/runtime/refresh.js'
import { touchesPage } from '~/lib/live-updates'

/**
 * Tells the reader when Drupal changes what the open page shows, and lets
 * them load the change when they choose. `AppLiveUpdate` shows the notice.
 */
export default ({ $sockets, $druxt, store }, inject) => {
  const live = Vue.observable({ changedAt: null, freshUntil: 0 })
  inject('liveUpdates', live)

  // A refresh's requests skip the copy the browser kept of Drupal's answers.
  if ($druxt && $druxt.axios) {
    $druxt.axios.interceptors.request.use((config) => {
      if (Date.now() < live.freshUntil) {
        config.headers = config.headers || {}
        config.headers['Cache-Control'] = 'no-cache'
      }
      return config
    })
  }

  if (!$sockets) return
  $sockets.on('content:changed', ({ payload = {} }) => {
    const resources = (store.state.druxt || {}).resources || {}
    if (touchesPage(payload.tags, (tags) => affected(tags, resources))) {
      live.changedAt = Date.now()
    }
  })
}
