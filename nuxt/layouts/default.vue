<template>
  <div class="min-h-screen flex flex-col bg-base-100 text-base-content font-sans antialiased">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:m-3 focus:px-4 focus:py-2 focus:rounded-btn focus:bg-primary focus:text-primary-content"
    >Skip to content</a>

    <AppHeader
      class="sticky top-0 z-50"
      title="DruxtJS"
      :version="$config.druxtVersion ? 'v' + $config.druxtVersion : null"
      :docs="isDocs"
      @open-search="searchOpen = true"
      @open-nav="sidebar = true"
    />

    <!-- Documentation pages: sidebar / content / on-this-page -->
    <div v-if="isDocs" class="docs-grid flex-grow w-full max-w-[110rem] mx-auto" :class="{ 'docs-grid-wide': wide }">
      <AppSidebar :open="sidebar" @close="sidebar = false" @open-search="searchOpen = true" />

      <main id="main" class="min-w-0 px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <AppBreadcrumbBar />
        <!-- Module identity chrome, in the layout so it survives navigation
             between a module's pages. On other routes it renders only the
             slot. -->
        <AppModuleHeader>
          <div class="mx-auto" :class="wide ? '' : 'max-w-content'">
            <Nuxt />
          </div>
        </AppModuleHeader>
      </main>

      <!-- Wide pages have no headings to list, and take the column instead. -->
      <aside v-if="!wide" class="hidden xl:block py-12 pr-8">
        <AppToc class="sticky top-24" />
      </aside>
    </div>

    <!-- Full-bleed pages (home) opt out of the docs grid, but keep the drawer
         the header's hamburger opens. -->
    <template v-else>
      <AppSidebar :open="sidebar" :docs="false" @close="sidebar = false" @open-search="searchOpen = true" />
      <main id="main" class="flex-grow">
        <Nuxt />
      </main>
    </template>

    <!-- Outside both layouts above, so it renders on every route. -->
    <AppSiteFooter :version="$config.druxtVersion ? 'v' + $config.druxtVersion : null" />

    <AppSearch :open="searchOpen" @close="searchOpen = false" />
  </div>
</template>

<script>
import { trapTab } from '~/utils/focus'

export default {
  data: () => ({
    sidebar: false,
    searchOpen: false,
    /** Element to return focus to when the drawer closes. */
    restoreFocusTo: null,
  }),

  computed: {
    isDocs: ({ $route }) => $route.path !== '/',
    /** The playground has no prose to cap and no headings to list. */
    wide: ({ $route }) => $route.path.replace(/\/$/, '') === '/playground',
  },

  watch: {
    // Nuxt's own scroll-to-top does not fire when a navigation crosses the
    // isDocs boundary. Path-gated, so table of contents jumps still work.
    $route(to, from) {
      this.sidebar = false
      this.searchOpen = false
      if (to.path !== from.path) window.scrollTo({ top: 0, behavior: 'instant' })
    },

    /**
     * Drawer focus handling: opening moves focus into the drawer, closing
     * returns it to whatever opened it.
     *
     * @param {boolean} open - Whether the drawer is now open.
     */
    sidebar(open) {
      if (open) {
        this.restoreFocusTo = document.activeElement
        this.$nextTick(() => {
          const close = document.querySelector('aside [aria-label="Close menu"]')
          if (close) close.focus()
        })
        return
      }
      const target = this.restoreFocusTo
      this.restoreFocusTo = null
      if (target && document.contains(target)) this.$nextTick(() => target.focus())
    },
  },

  mounted() {
    this.onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || e.target.isContentEditable
      const cmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'
      if (cmdK || (e.key === '/' && !typing)) {
        e.preventDefault()
        this.searchOpen = true
      }
      // The drawer is a modal overlay; Escape is the keyboard way out.
      if (e.key === 'Escape' && this.sidebar) this.sidebar = false

      // Keep Tab inside the drawer while it is open.
      if (this.sidebar) trapTab(document.querySelector('aside'), e)
    }
    window.addEventListener('keydown', this.onKey)
  },

  beforeDestroy() {
    window.removeEventListener('keydown', this.onKey)
  },
}
</script>

<style scoped>
/* Plain CSS, because this Tailwind version does not convert the
   underscore-as-space in a multi-token arbitrary value such as
   grid-cols-[17rem_minmax(0,1fr)]. */
@media (min-width: 1024px) {
  .docs-grid {
    display: grid;
    grid-template-columns: 17rem minmax(0, 1fr);
  }
}

@media (min-width: 1280px) {
  .docs-grid {
    grid-template-columns: 17rem minmax(0, 1fr) 15rem;
  }

  .docs-grid-wide {
    grid-template-columns: 17rem minmax(0, 1fr);
  }
}
</style>
