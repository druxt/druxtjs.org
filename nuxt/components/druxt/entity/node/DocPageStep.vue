<template>
  <AppPageCard :title="title" :description="description" :to="to" step arrow />
</template>

<script>
/**
 * A page in its step view mode: one numbered step of its section.
 *
 * Rendered by the docs_section view's sequence display. The number comes
 * from the list around it, a CSS counter, so the order is the view's.
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
