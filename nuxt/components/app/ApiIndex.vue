<template>
  <section v-if="groups.length">
    <div class="flex items-baseline justify-between gap-4 mb-4">
      <h2 id="api-reference" class="text-xl font-semibold">API reference</h2>
      <NuxtLink class="text-sm hover:text-primary-focus" :to="'/api/packages/' + pkg">
        All {{ total }} entries
      </NuxtLink>
    </div>

    <p class="mb-5 text-sm text-base-content/70">
      Generated from the <code>{{ pkg }}</code> package source. Components, mixins and stores are
      listed here so the module documentation and the API reference stay one click apart.
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <div v-for="group of groups" :key="group.type" class="rounded-box border border-base-300 p-4">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-base-content/70 mb-2" v-text="group.label" />
        <ul class="space-y-1">
          <li v-for="item of group.items" :key="item.path">
            <NuxtLink
              class="text-sm hover:text-primary-focus"
              :class="item.deprecated ? 'text-base-content/50' : ''"
              :to="item.path"
              v-text="item.title"
            /><span v-if="item.deprecated" class="sr-only">(deprecated)</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script>
// Keys are directory segments docgen emits under api/packages/<pkg>/.
// `package` covers entries at the package root; `other` is the fallback.
const LABELS = {
  components: 'Components',
  mixins: 'Mixins',
  stores: 'Vuex stores',
  composables: 'Composables',
  typedefs: 'Type definitions',
  utils: 'Utilities',
  nuxt: 'Nuxt integration',
  package: 'Package',
  other: 'Other',
}

export default {
  props: {
    /** Package name, e.g. 'entity'. */
    pkg: { type: String, required: true },
  },

  data: () => ({ entries: [] }),

  computed: {
    total: ({ entries }) => entries.length,

    // Entries bucketed by the directory they were generated from.
    groups: ({ entries, pkg }) => {
      const root = 'api/packages/' + pkg
      const buckets = {}
      entries.forEach((entry) => {
        const dir = entry.dir || ''
        const parts = dir.split('/')
        // Root-level entries have no directory segment, so match the package
        // root explicitly.
        const type = Object.keys(LABELS).find((key) => parts.includes(key))
          || (dir.replace(/^\/+|\/+$/g, '').endsWith(root) ? 'package' : 'other')
        buckets[type] = buckets[type] || []
        buckets[type].push(entry)
      })

      return Object.keys(LABELS)
        .filter((type) => buckets[type])
        .map((type) => ({
          type,
          label: LABELS[type],
          // Live entries first, deprecated dimmed below them, both A-Z.
          items: buckets[type].slice().sort((a, b) =>
            (!a.deprecated === !b.deprecated
              ? (a.title || '').localeCompare(b.title || '')
              : (a.deprecated ? 1 : -1))),
        }))
    },
  },

  watch: {
    pkg: { immediate: true, handler: 'fetch' },
  },

  methods: {
    async fetch() {
      // This instance is reused across route changes, so discard a response
      // for a package that is no longer the current one.
      const pkg = this.pkg
      try {
        const entries = await this.$content('api/packages/' + pkg, { deep: true })
          .only(['title', 'path', 'dir', 'deprecated'])
          .fetch()
        if (pkg !== this.pkg) return
        // Matched on the filename, not the title: docgen retitles these
        // pages, so a title test would miss them.
        this.entries = (Array.isArray(entries) ? entries : [entries])
          .filter((o) => o && !/^(README|CHANGELOG|index)$/i.test((o.path || '').split('/').pop()))
      } catch (e) {
        if (pkg !== this.pkg) return
        this.entries = []
      }
    },
  },
}
</script>
