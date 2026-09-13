<template>
  <div>
    <DuiRichText v-for="(item, delta) in items" :key="delta" :html="item.processed || item.value || ''" :heading-id="headingId" />
  </div>
</template>

<script>
import { headingId } from '~/utils/headings'

/** Formatted text fields, with heading anchors for the table of contents. */
export default {
  props: {
    schema: { type: Object, default: () => ({}) },
    value: { type: [Array, Object], default: null },
  },
  computed: {
    items: ({ value }) => (Array.isArray(value) ? value : value ? [value] : []),
  },
  methods: { headingId },
}
</script>
