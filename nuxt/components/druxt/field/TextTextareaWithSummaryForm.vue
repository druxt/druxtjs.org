<template>
  <!-- Formatted text: the text itself, and its summary where the widget has one. -->
  <div>
    <strong v-if="label">{{ label }}:</strong>
    <textarea :value="item.value || ''" :rows="rows" @input="$emit('input', { ...item, value: $event.target.value })" />
    <template v-if="'summary' in item">
      <strong>{{ label }} summary:</strong>
      <textarea :value="item.summary || ''" rows="2" @input="$emit('input', { ...item, summary: $event.target.value })" />
    </template>
  </div>
</template>

<script>
import { single } from '~/utils/form-widgets'

export default {
  props: {
    schema: { type: Object, default: () => ({}) },
    value: { type: [Array, Object, String], default: null },
  },
  computed: {
    label: ({ schema }) => ((schema || {}).label || {}).text || '',
    item: ({ value }) => {
      const v = single(value)
      return v && typeof v === 'object' ? v : { value: v || '' }
    },
    rows: ({ schema }) => ((((schema || {}).settings || {}).display || {}).rows) || 6,
  },
}
</script>
