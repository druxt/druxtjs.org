<template>
  <!-- A number widget as a select over its range: a weight reads better picked than typed. A broad range is typed into. -->
  <div>
    <strong v-if="label">{{ label }}:</strong>
    <select v-if="range" :value="current" @change="$emit('input', Number($event.target.value))">
      <option v-for="n in range" :key="n" :value="n">{{ n }}</option>
    </select>
    <input v-else type="number" :value="current" :min="bounds.min" :max="bounds.max" @change="$emit('input', Number($event.target.value))">
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
    bounds: ({ schema }) => ((schema || {}).settings || {}).config || {},
    /** Null when the range is too broad to pick from. */
    range: ({ schema, value }) => numberRange(schema, value),
  },
}
</script>
