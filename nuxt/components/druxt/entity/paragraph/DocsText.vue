<template>
  <div>
    <slot name="field_text" />
  </div>
</template>

<script>
/** A markdown text block. */
export default {
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
