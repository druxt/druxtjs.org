<template>
  <!-- Cards, not a list: the prose styles every list it holds, markers included. -->
  <nav v-if="pages.length" class="not-prose mt-6 grid gap-3" aria-label="Pages in this section">
    <NuxtLink
      v-for="page in pages"
      :key="page.id"
      :to="page.to"
      class="group block rounded-box border border-base-300 p-4 no-underline hover:border-primary transition-colors"
    >
      <span class="block font-medium group-hover:text-primary-focus" v-text="page.title" />
      <span v-if="page.description" class="block mt-1 text-sm text-base-content/70" v-text="page.description" />
    </NuxtLink>
  </nav>
</template>

<script>
/**
 * The docs_section view: a section's published pages in their order.
 *
 * Rendered on the section landing below its introduction, in place of a
 * hand-written list, so a page appears as soon as it is published with a
 * section. The landing itself is a page of its section and is left out.
 */
export default {
  props: {
    results: { type: Array, default: () => [] },
    view: { type: Object, default: () => ({}) },
    display: { type: Object, default: () => ({}) },
    pager: { type: Object, default: () => ({}) },
    count: { type: Number, default: 0 },
  },
  computed: {
    pages() {
      const current = this.$route.path.replace(/\/$/, '')
      return this.results
        .map((page) => {
          const a = page.attributes || {}
          return {
            id: page.id,
            title: a.title,
            description: a.field_description || '',
            to: (a.path && a.path.alias) || '',
          }
        })
        .filter((page) => page.to && page.to !== current)
    },
  },
}
</script>
