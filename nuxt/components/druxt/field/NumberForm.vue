<template>
  <!-- A number widget as a select over its range: a weight reads better picked than typed. -->
  <div>
    <strong v-if="label">{{ label }}:</strong>
    <select :value="current" @change="$emit('input', Number($event.target.value))">
      <option v-for="n in range" :key="n" :value="n">{{ n }}</option>
    </select>
  </div>
</template>

<script>
import { numberRange, single } from '~/utils/form-widgets'

export default {
  props: {
    schema: { type: Object, default: () => ({}) },
    value: { type: [Number, String, Array], default: null },
  },
  computed: {
    label: ({ schema }) => ((schema || {}).label || {}).text || '',
    current: ({ value }) => Number(single(value)) || 0,
    range: ({ schema, value }) => numberRange(schema, value),
  },
}
</script>
