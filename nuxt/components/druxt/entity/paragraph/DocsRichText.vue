<template>
  <div>
    <slot name="field_rich_text" />
  </div>
</template>

<script>
/** A rich text block. */
export default {
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
