<template>
  <!-- An autocomplete widget: what is referenced, by label, as Drupal fills it in. -->
  <div>
    <strong v-if="label">{{ label }}:</strong>
    <input type="text" :value="text" :placeholder="placeholder" readonly>
  </div>
</template>

<script>
import { referenceItems } from '~/utils/form-widgets'

export default {
  props: {
    schema: { type: Object, default: () => ({}) },
    value: { type: [Array, Object, String], default: null },
  },
  data: () => ({ entities: {} }),
  async fetch() {
    // The label of each reference, where the backend lets us read it.
    const found = await Promise.all(referenceItems(this.value).map((ref) =>
      this.$store.dispatch('druxt/getResource', { type: ref.type, id: ref.id }).then((r) => [ref.id, (r || {}).data || null], () => [ref.id, null]),
    ))
    this.entities = Object.fromEntries(found)
  },
  computed: {
    label: ({ schema }) => ((schema || {}).label || {}).text || '',
    placeholder: ({ schema }) => ((((schema || {}).settings || {}).display || {}).placeholder) || '',
    text: ({ entities, value }) =>
      referenceItems(value)
        .map((ref) => {
          const a = ((entities[ref.id] || {}).attributes) || {}
          const name = a.display_name || a.name || a.title || a.label
          return name ? `${name} (${ref.id.slice(0, 8)})` : ref.id
        })
        .join(', '),
  },
}
</script>
