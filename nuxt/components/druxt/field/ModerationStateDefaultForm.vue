<template>
  <!-- The moderation state: its transitions belong to the workflow, so here it only reads. -->
  <div>
    <strong v-if="label">{{ label }}:</strong>
    <input type="text" :value="current" readonly>
  </div>
</template>

<script>
import { single } from '~/utils/form-widgets'

export default {
  props: {
    schema: { type: Object, default: () => ({}) },
    value: { type: [Array, String], default: null },
  },
  computed: {
    label: ({ schema }) => ((schema || {}).label || {}).text || '',
    current: ({ value }) => single(value) || '',
  },
}
</script>
