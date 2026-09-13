<template>
  <!-- Parent route for /modules/*. The module identity chrome lives in the
       layout; this route adds only the index document's own header. -->
  <div>

    <!-- /modules itself: the index document's own title and description. -->
    <AppPageHeader v-if="index" :title="index.title" :description="index.description" />

    <NuxtChild :pkg="pkg" />
  </div>
</template>

<script>

export default {
  name: 'AppModulesParent',

  // Nuxt's default scrollBehavior only resets scroll for a nested route
  // (parent + child match) if some matched component opts in explicitly.
  scrollToTop: true,

  data: () => ({ index: null }),

  // Nuxt's fetch() hook, not a plain method: SSR awaits it before sending HTML.
  async fetch() {
    // Captured before awaiting and re-checked after: this instance is reused
    // across /modules/<pkg> routes, so two fetches can be in flight at once.
    const pkg = this.pkg
    if (pkg) {
      this.index = null
      return
    }

    const index = await this.$content('modules/README')
      .only(['title', 'description'])
      .fetch()
      .catch(() => null)
    if (this.pkg) return
    this.index = index
  },

  computed: {
    /** 'entity' for /modules/entity/deprecations; null on the index. */
    pkg() {
      const [, , pkg] = this.$route.path.split('/')
      return pkg || null
    },
  },

  watch: {
    // Re-fetches when navigating between sibling modules: this instance is
    // reused, and Nuxt does not infer that from the child route param.
    pkg() {
      this.$fetch()
    },
  },
}
</script>
