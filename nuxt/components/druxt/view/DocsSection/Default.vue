<template>
  <!-- The prose styles reach in here, so the heading and the cards carry their own rules (assets/css/app.css). -->
  <div v-if="groups.length" class="mt-6 flex flex-col gap-6" aria-label="Pages in this section">
    <section v-for="group in groups" :key="group.id">
      <h2 v-if="group.name" class="page-group-heading" v-text="group.name" />
      <div class="grid gap-3 sm:grid-cols-2">
        <DruxtEntity v-for="page in group.pages" :key="page.id" :type="page.type" :uuid="page.id" mode="teaser" />
      </div>
    </section>
  </div>
</template>

<script>
/**
 * The docs_section view's default display: the section's pages as cards.
 *
 * Each page renders in its teaser view mode, under the heading of its topic
 * term, in the terms' weight order. Pages with no topic come first, under
 * no heading, and the landing itself is left out.
 */
export default {
  props: {
    results: { type: Array, default: () => [] },
    view: { type: Object, default: () => ({}) },
    display: { type: Object, default: () => ({}) },
    pager: { type: Object, default: () => ({}) },
    count: { type: Number, default: 0 },
  },
  data: () => ({ topics: [] }),
  async fetch() {
    const collection = await this.$store.dispatch('druxt/getCollection', {
      type: 'taxonomy_term--documentation_topic',
      query: { 'fields[taxonomy_term--documentation_topic]': 'name,weight', sort: 'weight,name' },
    })
    this.topics = ((collection && collection.data) || []).map((term) => ({ id: term.id, name: term.attributes.name }))
  },
  computed: {
    pages() {
      const current = this.$route.path.replace(/\/$/, '')
      return this.results.filter((page) => (((page.attributes || {}).path || {}).alias || '') !== current)
    },
    groups() {
      const topicOf = (page) => ((((page.relationships || {}).field_topic || {}).data) || {}).id || ''
      const groups = [{ id: '', name: '', pages: [] }, ...this.topics.map((topic) => ({ ...topic, pages: [] }))]
      for (const page of this.pages) {
        const group = groups.find((o) => o.id === topicOf(page)) || groups[0]
        group.pages.push(page)
      }
      return groups.filter((group) => group.pages.length)
    },
  },
}
</script>
