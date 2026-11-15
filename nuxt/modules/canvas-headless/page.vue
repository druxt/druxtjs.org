<template>
  <main>
    <CanvasPage :path="path" :page="page" :session="session" />
  </main>
</template>

<script>
// A Canvas page at its own path.
import CanvasPage from './CanvasPage'
import load from './load'
import layout from './layout'

export default {
  components: { CanvasPage },

  layout,

  async asyncData({ route, req, error, redirect }) {
    const path = route.fullPath.split('#')[0]
    const data = await load(path, req)
    if (!data.page) return error({ statusCode: 404, message: 'Not found' })
    // A path Drupal redirects has no content of its own.
    if (data.page.redirect) return redirect(data.page.redirect.statusCode || 302, data.page.redirect.url)
    return { ...data, path }
  },

  head() {
    return { title: (this.page && this.page.head && this.page.head.title) || '' }
  },
}
</script>
