<template>
  <!-- .nuxt-content so content-links.client.js routes internal links, as it does for markdown. -->
  <div class="nuxt-content">
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
 */
export default {
  // DruxtEntity's other props (fields, schema, value) are not HTML attributes.
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
  },
  computed: {
    paragraphs() {
      const refs = ((((this.entity || {}).relationships || {}).field_content || {}).data) || []
      const resources = this.$store.state.druxt.resources
      return refs
        .map((ref) => {
          const stored = (resources[ref.type] || {})[ref.id] || {}
          const resource = stored[undefined] || stored[''] || Object.values(stored)[0]
          return resource && resource.data
        })
        .filter(Boolean)
    },
    roots() {
      return this.paragraphs.filter((paragraph) => layoutOf(paragraph).layout || !layoutOf(paragraph).parent_uuid)
    },
  },
  methods: {
    layoutOf,
    childrenOf(section) {
      return this.paragraphs.filter((paragraph) => layoutOf(paragraph).parent_uuid === section.id)
    },
  },
}
</script>
