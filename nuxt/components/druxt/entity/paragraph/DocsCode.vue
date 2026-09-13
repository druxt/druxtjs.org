<template>
  <DuiCodeBlock v-if="entity" :code="entity.attributes.field_code || ''" :language="entity.attributes.field_language || 'text'" />
</template>

<script>
/** A code block, highlighted by its declared language. */
export default {
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
