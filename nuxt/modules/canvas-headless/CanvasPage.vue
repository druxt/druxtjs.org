<template>
  <div>
    <canvas-draft-session
      v-if="session.enabled"
      :token-expires-at="session.tokenExpiresAt"
      :initial-expired="session.expired || undefined"
      :renew-url="session.renewUrl"
      :editor-origin="session.editorOrigin"
      renew-endpoint="/api/draft/renew"
      :path="$route.fullPath.split('#')[0]"
    />
    <CanvasComponentTree :tree="current ? current.content : null" />
  </div>
</template>

<script>
/**
 * A Canvas page as the content API answered: the published page, or the
 * editor's draft in a draft session, which is read again each time Canvas
 * saves one.
 */
import CanvasComponentTree from './CanvasComponentTree'
import load from './load'

const REFRESH = 'canvas-draft-session:refresh-requested'

export default {
  components: { CanvasComponentTree },

  props: {
    /** The page's path in Drupal. */
    path: { type: String, required: true },
    page: { type: Object, default: null },
    session: { type: Object, default: () => ({ enabled: false }) },
  },

  data: () => ({ refreshed: null }),

  computed: {
    current: ({ refreshed, page }) => refreshed || page,
  },

  // The SDK's session element and its styles, in a draft session only.
  head() {
    if (!this.session.enabled) return {}
    return {
      link: [{ rel: 'stylesheet', href: '/_canvas-headless/preview.css' }],
      script: [{ src: '/_canvas-headless/client.js', defer: true }],
    }
  },

  mounted() {
    this.refresh = async (event) => {
      event.preventDefault()
      // A read that fails, or finds no content, leaves the page as it was.
      const { page } = await load(this.path).catch(() => ({}))
      if (page && !page.redirect) this.refreshed = page
    }
    document.addEventListener(REFRESH, this.refresh)
  },

  beforeDestroy() {
    document.removeEventListener(REFRESH, this.refresh)
  },
}
</script>
