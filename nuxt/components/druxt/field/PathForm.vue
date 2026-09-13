<template>
  <!-- The path widget: the alias, the one part a person types. -->
  <div>
    <strong v-if="label">{{ label }}:</strong>
    <input type="text" :value="alias" placeholder="/path/alias" @input="$emit('input', { ...item, alias: $event.target.value })">
  </div>
</template>

<script>
import { single } from '~/utils/form-widgets'

export default {
  props: {
    schema: { type: Object, default: () => ({}) },
    value: { type: [Array, Object], default: null },
  },
  computed: {
    label: ({ schema }) => ((schema || {}).label || {}).text || '',
    item: ({ value }) => single(value) || {},
    alias: ({ item }) => item.alias || '',
  },
}
</script>
