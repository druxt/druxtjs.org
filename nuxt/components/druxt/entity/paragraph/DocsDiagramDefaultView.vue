<template>
  <div :data-druxt-entity="(entity || {}).id || false" :data-druxt-type="(entity || {}).type" data-druxt-field="field_diagram">
    <DuiDiagram v-if="entity" :source="entity.attributes.field_diagram || ''" />
  </div>
</template>

<script>
/** A mermaid diagram. */
export default {
  // DruxtEntity's other props (fields, schema, value) are not HTML attributes.
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
