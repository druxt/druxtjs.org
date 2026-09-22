<template>
  <div :data-druxt-entity="(entity || {}).id || false" :data-druxt-type="(entity || {}).type" data-druxt-field="field_code">
    <DuiCodeBlock v-if="entity" :code="entity.attributes.field_code || ''" :language="entity.attributes.field_language || 'text'" />
  </div>
</template>

<script>
/** A code block, highlighted by its declared language. */
export default {
  // DruxtEntity's other props (fields, schema, value) are not HTML attributes.
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
