<template>
  <!-- The language select: what the backend speaks. -->
  <div>
    <strong v-if="label">{{ label }}:</strong>
    <select :value="current" @change="$emit('input', $event.target.value)">
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
</template>

<script>
import { single } from '~/utils/form-widgets'

export default {
  props: {
    schema: { type: Object, default: () => ({}) },
    value: { type: [Array, String], default: null },
  },
  data: () => ({ languages: [] }),
  async fetch() {
    // Configurable languages, unlocked ones; a backend without the language module exposes none.
    const collection = await this.$store.dispatch('druxt/getCollection', { type: 'configurable_language--configurable_language' }).catch(() => null)
    this.languages = ((collection || {}).data || []).filter((o) => !(o.attributes || {}).locked).map((o) => ({ value: o.attributes.drupal_internal__id, label: `${o.attributes.label} (${o.attributes.drupal_internal__id})` }))
  },
  computed: {
    label: ({ schema }) => ((schema || {}).label || {}).text || '',
    current: ({ value }) => single(value) || '',
    // At least the current value, so the select never reads empty.
    options: ({ languages, current }) => (languages.some((o) => o.value === current) || !current ? languages : [{ value: current, label: current }, ...languages]),
  },
}
</script>
