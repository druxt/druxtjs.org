<template>
  <div>
    <slot name="field_text" />
  </div>
</template>

<script>
/** A markdown text block. */
export default {
  // DruxtEntity's other props (fields, schema, value) are not HTML attributes.
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
