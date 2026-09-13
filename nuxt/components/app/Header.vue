<template>
  <header class="w-full border-b border-base-300 bg-base-100/90 backdrop-blur">
    <div class="max-w-[110rem] mx-auto h-16 px-4 sm:px-6 flex items-center gap-3">
      <!-- Hidden wherever the drawer is: documentation pages keep a sidebar from `lg`, the home page from `xl`. -->
      <button
        type="button"
        class="btn btn-ghost btn-square btn-sm -ml-1"
        :class="docs ? 'lg:hidden' : 'xl:hidden'"
        aria-label="Open navigation menu"
        @click="$emit('open-nav')"
      >
        <AppIconMenu class="w-5 h-5" />
      </button>

      <!-- The branding and section nav are Drupal blocks, in the header region of the consumer's theme. -->
      <DruxtBlockRegion v-if="theme" name="header" :theme="theme" />

      <!-- The version links to its release notes, the generated page from the package's changelog. -->
      <NuxtLink
        v-if="version"
        class="badge badge-sm badge-outline hidden sm:inline-flex hover:border-primary hover:text-primary-focus"
        to="/api/packages/druxt/CHANGELOG"
        :title="'Druxt ' + version + ' release notes'"
      >{{ version }}</NuxtLink>

      <div class="flex-1" />

      <!-- Wide enough for the longest shortcut bubble, so the label truncates instead of pushing it out. -->
      <button
        type="button"
        class="hidden sm:flex items-center gap-2 h-9 pl-3 pr-2 w-48 xl:w-56 rounded-btn border border-base-300 bg-base-200 text-sm text-base-content/70 hover:border-primary hover:text-base-content transition-colors"
        @click="$emit('open-search')"
      >
        <AppIconSearch class="w-4 h-4 flex-shrink-0" />
        <span class="flex-1 min-w-0 text-left truncate">Search docs</span>
        <kbd class="kbd kbd-xs flex-shrink-0">{{ shortcut }}</kbd>
      </button>
      <button
        type="button"
        class="sm:hidden btn btn-ghost btn-square btn-sm"
        aria-label="Search"
        @click="$emit('open-search')"
      >
        <AppIconSearch class="w-5 h-5" />
      </button>

      <div class="flex items-center gap-1 xl:pl-2 xl:border-l border-base-300">
        <a
          v-for="link of external"
          :key="link.text"
          class="hidden md:inline-flex btn btn-ghost btn-square btn-sm"
          :href="link.props.href"
          target="_blank"
          rel="noopener"
          :aria-label="link.text"
          :title="link.text"
        >
          <component :is="iconFor(link)" class="w-5 h-5" />
        </a>

        <AppColorModeToggle />
      </div>
    </div>
  </header>
</template>

<script>
import { MAC_SHORTCUT, searchShortcut } from '~/utils/platform'

export default {
  props: {
    version: { type: String, default: null },
    /** True on documentation pages, which keep a sidebar from `lg`. */
    docs: { type: Boolean, default: true },
  },

  data: () => ({ shortcut: MAC_SHORTCUT }),

  computed: {
    external: ({ $store }) => $store.state.menu.filter((o) => o.component === 'a'),
    /** The consumer's theme, from the decoupled settings theme manifest. */
    theme: ({ $config }) => ($config.decoupledTheme || {}).default,
  },

  mounted() {
    this.shortcut = searchShortcut()
  },

  methods: {
    // GitHub and Discord have their own marks; anything else falls back.
    iconFor(link) {
      return 'app-icon-' + (link.icon || 'external')
    },
  },
}
</script>
