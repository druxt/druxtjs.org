<template>
  <div>
    <slot name="field_rich_text" />
  </div>
</template>

<script>
/** A rich text block. */
export default {
  // DruxtEntity's other props (fields, schema, value) are not HTML attributes.
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
