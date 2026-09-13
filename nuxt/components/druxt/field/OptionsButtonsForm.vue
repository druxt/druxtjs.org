<template>
  <!-- The radios or checkboxes Drupal shows: one per allowed value, or per entity a reference can point at. -->
  <fieldset>
    <legend v-if="label"><strong>{{ label }}:</strong></legend>
    <p v-if="$fetchState.pending">loading</p>
    <label v-for="o in options" v-else :key="o.value" class="block">
      <input :type="multiple ? 'checkbox' : 'radio'" :name="name" :value="o.value" :checked="chosen.includes(o.value)" @change="pick(o, $event.target.checked)" />
      {{ o.label }}
    </label>
  </fieldset>
</template>

<script>
import { allowedOptions, entityOptions, referenceItems, referenceTypes, single, unrestrictedReference } from '~/utils/form-widgets'

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
    name: ({ schema }) => (schema || {}).id || 'options',
    multiple: ({ schema }) => (schema || {}).cardinality !== 1,
    options: ({ schema, entities }) => (entities.length ? entityOptions(entities) : allowedOptions(schema)),
    /** The values ticked now: reference ids, or the plain values a list field holds. */
    chosen: ({ value, relationship }) => (relationship || referenceItems(value).length ? referenceItems(value).map((o) => o.id) : [].concat(value == null ? [] : value).map((v) => (v && typeof v === 'object' ? v.value : String(v)))),
  },
  methods: {
    /** The referenceable resource types: the handler's bundles, or every bundle the backend's index names when the field is unrestricted. */
    async referenceTypes() {
      if (!unrestrictedReference(this.schema)) return referenceTypes(this.schema)
      const type = this.schema.settings.storage.target_type
      const index = await this.$druxt.getIndex().catch(() => ({}))
      return Object.keys(index).filter((t) => t.startsWith(`${type}--`))
    },
    pick(o, checked) {
      const item = o.type ? { type: o.type, id: o.value } : o.value
      if (!this.multiple) return this.$emit('input', item)
      const rest = this.options.filter((x) => x.value !== o.value && this.chosen.includes(x.value)).map((x) => (x.type ? { type: x.type, id: x.value } : x.value))
      this.$emit('input', checked ? [...rest, item] : rest)
    },
  },
}
</script>
