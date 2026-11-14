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

  async asyncData({ route, req, error }) {
    const path = route.fullPath.split('#')[0]
    const data = await load(path, req)
    if (!data.page) return error({ statusCode: 404, message: 'Not found' })
    return { ...data, path }
  },

  head() {
    return { title: (this.page && this.page.head && this.page.head.title) || '' }
  },
}
</script>
