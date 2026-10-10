<template>
  <AppPageCard :title="title" :description="description" :to="to" />
</template>

<script>
/**
 * A page in its teaser view mode: a card on its section landing.
 *
 * Rendered by the docs_section view's default display for each page it lists.
 */
export default {
  inheritAttrs: false,
  // The title and the path are base fields, outside the display; the
  // display's own fields are asked for by the schema.
  druxt: { query: { fields: ['title', 'path'] } },
  props: {
    entity: { type: Object, default: () => ({}) },
    fields: { type: [Object, Boolean], default: undefined },
    schema: { type: Object, default: undefined },
    value: { type: Object, default: undefined },
  },
  computed: {
    title: ({ entity }) => (entity.attributes || {}).title || '',
    description: ({ entity }) => (entity.attributes || {}).field_description || '',
    to: ({ entity }) => ((entity.attributes || {}).path || {}).alias || '',
  },
}
</script>
