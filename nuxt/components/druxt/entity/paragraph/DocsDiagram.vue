<template>
  <DuiDiagram v-if="entity" :source="entity.attributes.field_diagram || ''" />
</template>

<script>
/** A mermaid diagram. */
export default {
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
