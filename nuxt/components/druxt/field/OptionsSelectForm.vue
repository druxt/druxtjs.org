<template>
  <!-- The select Drupal shows: a list field's allowed values, or the entities a reference can point at. -->
  <div>
    <strong v-if="label">{{ label }}:</strong>
    <select :value="current" @change="pick($event.target.value)">
      <option v-if="$fetchState.pending" value="" disabled>loading</option>
      <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
    </select>
  </div>
</template>

<script>
import { allowedOptions, entityOptions, referenceId, referenceTypes, unrestrictedReference } from '~/utils/form-widgets'

export default {
  props: {
    relationship: { type: Boolean, default: false },
    schema: { type: Object, default: () => ({}) },
    value: { type: [Number, String, Array, Object], default: null },
  },
  data: () => ({ entities: [] }),
  async fetch() {
    // A reference lists what it can point at: each target bundle's entities.
    // One bundle's failure keeps the others selectable.
    const collections = await Promise.all((await this.referenceTypes()).map((type) =>
      this.$store.dispatch('druxt/getCollection', { type }).catch(() => null)
    ))
    this.entities = collections.flatMap((c) => (c || {}).data || [])
  },
  computed: {
    label: ({ schema }) => ((schema || {}).label || {}).text || '',
    current: ({ value }) => referenceId(value),
    options: ({ schema, entities }) => (entities.length ? entityOptions(entities) : allowedOptions(schema)),
  },
  methods: {
    /** The referenceable resource types: the handler's bundles, or every bundle the backend's index names when the field is unrestricted. */
    async referenceTypes() {
      if (!unrestrictedReference(this.schema)) return referenceTypes(this.schema)
      const type = this.schema.settings.storage.target_type
      const index = await this.$druxt.getIndex().catch(() => ({}))
      return Object.keys(index).filter((t) => t.startsWith(`${type}--`))
    },
    pick(value) {
      const o = this.options.find((x) => x.value === value) || {}
      this.$emit('input', o.type ? { type: o.type, id: value } : value)
    },
  },
}
</script>
