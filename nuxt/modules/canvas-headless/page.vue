<template>
  <main>
    <canvas-draft-session
      v-if="session.enabled"
      :token-expires-at="session.tokenExpiresAt"
      :initial-expired="session.expired || undefined"
      :renew-url="session.renewUrl"
      :editor-origin="session.editorOrigin"
      renew-endpoint="/api/draft/renew"
      :path="$route.fullPath.split('#')[0]"
    />
    <CanvasComponentTree :tree="page ? page.content : null" />
  </main>
</template>

<script>
// A Canvas page, as the content API answers this request: the published page,
// or the editor's draft in a draft session.
import CanvasComponentTree from './CanvasComponentTree'

const REFRESH = 'canvas-draft-session:refresh-requested'

// On the server the module's middleware has the request and reads both. In
// the browser they come from its routes, with the session's cookies.
const load = async (path, req) => {
  if (req) return req.canvasHeadless.load(path)
  const get = (url) =>
    fetch(url, { credentials: 'same-origin' }).then((response) => (response.ok ? response.json() : null))
  const [page, session] = await Promise.all([
    get(`/api/canvas/page?path=${encodeURIComponent(path)}`),
    get('/api/draft/session'),
  ])
  return { page, session: session || { enabled: false } }
}

// The layouts a `layout` query parameter may name: the page alone, or the
// page in the site's own layout.
const LAYOUTS = { page: 'canvas-headless', site: 'default' }

export default {
  components: { CanvasComponentTree },

  // Framed, as Canvas's editor shows it, the page stands alone. Anywhere else
  // it has the site around it. `?layout=site` or `?layout=page` picks either.
  layout({ query, req }) {
    if (LAYOUTS[query.layout]) return LAYOUTS[query.layout]
    const framed = req ? req.headers['sec-fetch-dest'] === 'iframe' : window.self !== window.top
    return framed ? LAYOUTS.page : LAYOUTS.site
  },

  async asyncData({ route, req, error }) {
    const data = await load(route.fullPath.split('#')[0], req)
    if (!data.page) return error({ statusCode: 404, message: 'Not found' })
    return data
  },

  head() {
    const head = { title: (this.page && this.page.head && this.page.head.title) || '' }
    if (!this.session.enabled) return head
    return {
      ...head,
      link: [{ rel: 'stylesheet', href: '/_canvas-headless/preview.css' }],
      script: [{ src: '/_canvas-headless/client.js', defer: true }],
    }
  },

  mounted() {
    // Canvas saved a draft: read the page again, in place.
    this.refresh = async (event) => {
      event.preventDefault()
      const data = await load(this.$route.fullPath.split('#')[0])
      if (data.page) this.page = data.page
    }
    document.addEventListener(REFRESH, this.refresh)
  },

  beforeDestroy() {
    document.removeEventListener(REFRESH, this.refresh)
  },
}
</script>
