<template>
  <!--
    Wraps the page slot: a sticky element only sticks within its parent, so
    this wrapper has to span the page content.
  -->
  <div>
    <template v-if="pkg">
      <!-- Full header: identity, description, Source. -->
      <header class="mx-auto max-w-content pb-5">
        <!--
          On a package's own route this block is the page header, so it owns
          the h1. The visible title is a dropdown trigger, and a button cannot
          hold a heading, so the h1 sits here with the same text.
        -->
        <h1 v-if="isRoot" class="sr-only" v-text="title" />

        <div class="flex items-center gap-3 sm:gap-4">
          <span class="w-11 h-11 sm:w-14 sm:h-14 rounded-btn bg-base-200 text-primary-focus grid place-items-center flex-shrink-0">
            <component :is="icon" class="w-6 h-6 sm:w-8 sm:h-8" />
          </span>
          <!-- The whole identity is the module switcher; the menu lives in AppDropdown. -->
          <AppDropdown :items="siblings" button-class="min-w-0 px-1 -mx-1 hover:bg-base-200">
            <span class="min-w-0 flex flex-col text-left sm:flex-row sm:items-baseline sm:gap-3">
              <span class="text-2xl sm:text-3xl font-bold tracking-tight" v-text="title" />
              <span class="font-mono text-[13px] sm:text-[15px] text-primary-focus" v-text="name" />
            </span>
          </AppDropdown>
          <span class="flex-1" />
          <a class="btn btn-sm btn-ghost gap-2 flex-shrink-0" :href="repo" target="_blank" rel="noopener">
            <AppIconGithub class="w-4 h-4" /><span class="hidden sm:inline">Source</span>
          </a>
        </div>
        <p v-if="description" class="mt-3 text-[15px] text-base-content/70" v-text="description" />
      </header>

      <!-- The bar's stuck state flips when this sentinel passes under the site header. -->
      <div ref="sentinel" aria-hidden="true" />

      <!--
        The tab row is the sticky element, and switching tabs swaps only the
        slot content below it. The background is unconditional, so the bar
        always covers what it overlaps.
      -->
      <div
        class="sticky top-[108px] z-30 mb-8 bg-base-100/95 backdrop-blur"
        :class="stuck ? '-mx-5 sm:-mx-8 lg:-mx-12 border-b border-base-300' : ''"
      >
        <div
          class="flex items-center gap-3"
          :class="stuck ? 'h-12 sm:h-[52px] px-5 sm:px-8 lg:px-12' : 'mx-auto max-w-content'"
        >
          <template v-if="stuck">
            <span class="w-7 h-7 sm:w-8 sm:h-8 rounded-btn bg-base-200 text-primary-focus grid place-items-center flex-shrink-0">
              <component :is="icon" class="w-4 h-4 sm:w-5 sm:h-5" />
            </span>
            <!-- The switcher works while stuck too, same trigger idiom. -->
            <AppDropdown :items="siblings" button-class="px-1.5 py-0.5 -mx-1 hover:bg-base-200">
              <span class="flex items-baseline gap-2">
                <span class="text-[15px] sm:text-base font-bold" v-text="title" />
                <span class="hidden sm:inline font-mono text-[13px] text-primary-focus" v-text="name" />
              </span>
            </AppDropdown>
            <span class="flex-1" />
          </template>

          <!-- Mobile, stuck: the active tab plus a disclosure replaces the row. -->
          <button
            v-if="stuck"
            type="button"
            class="sm:hidden inline-flex items-center gap-1 text-sm font-medium text-primary-focus"
            :aria-expanded="open ? 'true' : 'false'"
            aria-controls="module-tabs"
            @click="open = !open"
          >
            {{ activeTab.text }}
            <span aria-hidden="true" class="text-xs">{{ open ? '▴' : '▾' }}</span>
          </button>

          <nav id="module-tabs" :class="navClasses">
            <!-- Right-edge fade hints at horizontal overflow on small screens. -->
            <div class="relative">
              <ul
                class="flex gap-1 overflow-x-auto"
                :class="stuck ? '' : 'border-b border-base-300'"
              >
                <li v-for="tab of tabs" :key="tab.to" class="flex-shrink-0">
                  <NuxtLink
                    :to="tab.to"
                    class="inline-block px-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap"
                    :class="[
                      stuck ? 'py-3.5' : 'py-2.5 -mb-px',
                      isActive(tab)
                        ? 'border-primary text-primary-focus'
                        : 'border-transparent text-base-content/70 hover:text-base-content',
                    ]"
                    :aria-current="isActive(tab) ? 'page' : null"
                    @click.native="onTabClick"
                    v-text="tab.text"
                  />
                </li>
              </ul>
              <span
                aria-hidden="true"
                class="sm:hidden pointer-events-none absolute right-0 top-0 bottom-px w-9 bg-gradient-to-r from-transparent to-base-100"
              />
            </div>
          </nav>
        </div>
      </div>
    </template>

    <slot />
  </div>
</template>

<script>
import { isPackageRoot, moduleIcon, moduleName, modulePkgs } from './icon/module'

export default {
  data: () => ({
    /** Whether the current navigation came from a stuck tab click. */
    fromStuckTab: false,
    /** The module's README document: { title, description }. */
    module: null,
    /** Sibling documents from content/modules/<pkg>/, for the content tabs. */
    pages: [],
    /** Whether the tab bar is stuck under the site header. */
    stuck: false,
    /** Mobile disclosure: whether the full tab row is revealed while stuck. */
    open: false,
  }),

  /**
   * Nuxt's fetch hook; SSR-awaited so the header arrives rendered. This
   * instance lives in the layout and survives route changes, so a slow fetch
   * is discarded once the module has changed.
   */
  async fetch() {
    const pkg = this.pkg

    if (!pkg) {
      this.module = null
      this.pages = []
      return
    }

    const [module, pages] = await Promise.all([
      this.$content('modules/' + pkg + '/README').only(['title', 'description']).fetch().catch(() => null),
      this.$content('modules/' + pkg).only(['title', 'path', 'slug']).fetch().catch(() => []),
    ])

    if (pkg !== this.pkg) return
    this.module = module
    this.pages = (Array.isArray(pages) ? pages : [pages]).filter(Boolean)
  },

  computed: {
    /**
     * The module a route is tied to, from /modules/<pkg> or
     * /api/packages/<pkg>, limited to the public module packages.
     *
     * @param {object} vm - The component ViewModel.
     * @param {object} vm.$route - The current route.
     * @returns {?string} The package directory name, or null.
     */
    pkg: ({ $route }) => {
      const [, first, second, third] = $route.path.split('/')
      const candidate =
        first === 'modules' ? second
        : first === 'api' && second === 'packages' ? third
        : null
      return candidate && modulePkgs.includes(candidate) ? candidate : null
    },

    /**
     * Whether this block is the page header, i.e. a package's own page rather
     * than one of the tabs beneath it. Page components read the same test.
     *
     * @param {object} vm - The component ViewModel.
     * @param {object} vm.$route - The current route.
     * @returns {boolean} True on a package root.
     */
    isRoot: ({ $route }) => isPackageRoot($route.path),

    /**
     * The module's display title, falling back to the package name when the
     * generated README is missing. The page component hides its own header
     * here, so this one always renders a title.
     *
     * @param {object} vm - The component ViewModel.
     * @param {?object} vm.module - The module's README document, or null.
     * @param {string} vm.name - The npm package name.
     * @returns {string} The title to display.
     */
    title: ({ module, name }) => (module || {}).title || name,

    /**
     * The module's description, when the README supplied one.
     *
     * @param {object} vm - The component ViewModel.
     * @param {?object} vm.module - The module's README document, or null.
     * @returns {?string} The description, or null.
     */
    description: ({ module }) => (module || {}).description || null,

    /**
     * The npm package name shown in mono; plain `druxt` for the core.
     *
     * @param {object} vm - The component ViewModel.
     * @param {string} vm.pkg - The package directory name.
     * @returns {string} The npm name.
     */
    name: ({ pkg }) => moduleName(pkg),

    /**
     * The module's icon component.
     *
     * @param {object} vm - The component ViewModel.
     * @param {string} vm.pkg - The package directory name.
     * @returns {object} The icon component.
     */
    icon: ({ pkg }) => moduleIcon(pkg),

    /**
     * GitHub URL for the Source button.
     *
     * @param {object} vm - The component ViewModel.
     * @param {string} vm.pkg - The package directory name.
     * @returns {string} The package directory URL on GitHub.
     */
    repo: ({ pkg }) => 'https://github.com/druxt/druxt.js/tree/develop/packages/' + pkg,

    /**
     * The other modules, for the switcher.
     *
     * @param {object} vm - The component ViewModel.
     * @param {object} vm.$store - The Vuex store.
     * @returns {object[]} Modules as { text, to }.
     */
    siblings: ({ $store }) => ($store.state.modules || []).map((m) => ({ text: m.title, to: m.dir })),

    /**
     * Tab order: README, API, Changelog, then the module's own content
     * documents.
     *
     * @param {object} vm - The component ViewModel.
     * @param {string} vm.pkg - The package directory name.
     * @param {object[]} vm.pages - The sibling content documents.
     * @returns {object[]} Ordered tabs as { text, to } objects.
     */
    tabs: ({ pkg, pages }) => {
      const base = '/modules/' + pkg
      const rest = pages
        .filter((o) => o.slug !== 'README')
        .map((o) => ({ text: o.title, to: o.path.replace('/content', '') }))

      return [
        { text: 'README', to: base },
        { text: 'API', to: '/api/packages/' + pkg },
        { text: 'Changelog', to: '/api/packages/' + pkg + '/CHANGELOG' },
      ].concat(rest)
    },

    /**
     * The tab matching the current route; Overview covers the fallback.
     *
     * @param {object} vm - The component ViewModel.
     * @param {object[]} vm.tabs - The ordered tabs.
     * @returns {object} The active tab.
     */
    activeTab({ tabs }) {
      return tabs.find((tab) => this.isActive(tab)) || tabs[0]
    },

    /**
     * Tab-row visibility. While stuck, mobile hides the row until the
     * disclosure drops it below the bar.
     *
     * @param {object} vm - The component ViewModel.
     * @param {boolean} vm.stuck - Whether the bar is stuck.
     * @param {boolean} vm.open - Whether the mobile disclosure is open.
     * @returns {string} The class list for the nav element.
     */
    navClasses: ({ stuck, open }) => {
      if (!stuck) return 'flex-1 min-w-0'
      if (open) {
        return 'block sm:min-w-0 absolute sm:static inset-x-0 top-full sm:top-auto bg-base-100/95 backdrop-blur sm:bg-transparent sm:backdrop-blur-none border-b border-base-300 sm:border-0 px-5 sm:px-0'
      }
      return 'hidden sm:block min-w-0'
    },
  },

  watch: {
    // Refetch only when the module changes; switching tabs leaves the header
    // as it is. The header renders on `pkg` alone, so the sentinel is rebound
    // here too.
    pkg() {
      this.open = false
      this.$fetch()
      this.$nextTick(() => this.observe())
    },

    $route() {
      // A tab clicked while stuck scrolls to the engage point, not the page
      // top. The double rAF runs after Nuxt's own scroll to top.
      if (this.fromStuckTab) {
        this.fromStuckTab = false
        this.$nextTick(() => {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const sentinel = this.$refs.sentinel
            if (!sentinel) return
            const engage = sentinel.getBoundingClientRect().top + window.scrollY - 63
            // Instant, so the correction does not animate over the jump to top.
            window.scrollTo({ top: Math.max(engage, 0), behavior: 'instant' })
          }))
        })
      }
    },
  },

  mounted() {
    this.observe()
  },

  beforeDestroy() {
    if (this.observer) this.observer.disconnect()
  },

  methods: {
    /**
     * (Re)binds the stuck observer to the sentinel. The rootMargin matches the
     * 108px band the site header and breadcrumb bar occupy.
     */
    observe() {
      if (this.observer) this.observer.disconnect()
      if (!this.$refs.sentinel) return
      this.observer = new IntersectionObserver(
        ([entry]) => {
          this.stuck = !entry.isIntersecting
          if (!this.stuck) this.open = false
        },
        { rootMargin: '-108px 0px 0px 0px', threshold: 0 },
      )
      this.observer.observe(this.$refs.sentinel)
    },

    /** Records the stuck state for the route watcher's scroll handling. */
    onTabClick() {
      this.fromStuckTab = this.stuck
      this.open = false
    },

    /**
     * Whether a tab matches the current route. Content tabs match exactly;
     * the API tab also claims the reference pages beneath it.
     *
     * @param {object} tab - The tab as a { text, to } object.
     * @returns {boolean} True when the tab is the current page.
     */
    isActive(tab) {
      const path = this.$route.path.replace(/\/+$/, '')
      if (path === tab.to) return true
      // Keyed on the route, not the label: only the API root claims the
      // pages beneath it.
      return (
        tab.to === '/api/packages/' + this.pkg &&
        path.startsWith(tab.to + '/') &&
        path !== tab.to + '/CHANGELOG'
      )
    },
  },
}
</script>
