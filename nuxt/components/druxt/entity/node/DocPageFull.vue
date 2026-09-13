<template>
  <!-- .nuxt-content so content-links.client.js routes internal links, as it does for markdown. -->
  <!-- Only once every paragraph is in: the layout keeps the children it is first given. -->
  <div v-if="!$fetchState.pending" class="nuxt-content">
    <template v-for="paragraph in roots">
      <DruxtLayoutParagraph
        v-if="layoutOf(paragraph).layout"
        :key="paragraph.id"
        :entity="paragraph"
        :children="childrenOf(paragraph)"
      />
      <DruxtEntity v-else :key="paragraph.id" :type="paragraph.type" :uuid="paragraph.id" />
    </template>
  </div>
</template>

<script>
const layoutOf = (paragraph) => ((paragraph.attributes || {}).behavior_settings || {}).layout_paragraphs || {}

/**
 * A documentation page's body: its layout sections, each with its blocks.
 *
 * Read from the paragraphs the page was fetched with, which the Druxt store
 * already holds, rather than through DruxtFieldLayoutParagraphs, which fetches
 * them again and renders nothing until that fetch settles in the browser.
 * A node fetched on its own, as the live examples do, gets them fetched here.
 */
export default {
  // Every DruxtEntity prop is declared, so none leaks as an attribute. Not
  // `inheritAttrs: false`: that would also drop the data-fetch-key Nuxt
  // stamps on the root, and the browser would run fetch() again.
  props: {
    entity: { type: Object, default: undefined },
    fields: { type: [Object, Boolean], default: undefined },
    schema: { type: Object, default: undefined },
    value: { type: Object, default: undefined },
  },
  async fetch() {
    const missing = this.refs.filter((ref) => !this.stored(ref))
    await Promise.all(missing.map((ref) => this.$store.dispatch('druxt/getResource', { type: ref.type, id: ref.id })))
  },
  computed: {
    refs() {
      return ((((this.entity || {}).relationships || {}).field_content || {}).data) || []
    },
    paragraphs() {
      return this.refs.map((ref) => this.stored(ref)).filter(Boolean)
    },
    roots() {
      return this.paragraphs.filter((paragraph) => layoutOf(paragraph).layout || !layoutOf(paragraph).parent_uuid)
    },
  },
  methods: {
    layoutOf,
    /** The paragraph's data in the store, whatever prefix it was stored under. */
    stored(ref) {
      const stored = ((this.$store.state.druxt.resources[ref.type] || {})[ref.id]) || {}
      const resource = stored[undefined] || stored[''] || Object.values(stored)[0]
      return resource && resource.data
    },
    childrenOf(section) {
      return this.paragraphs.filter((paragraph) => layoutOf(paragraph).parent_uuid === section.id)
    },
  },
}
</script>
