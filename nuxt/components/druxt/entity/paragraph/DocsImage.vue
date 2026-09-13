<template>
  <div>
    <slot name="field_media" />
  </div>
</template>

<script>
/** An image, rendered through its media entity. AppProse turns it into a figure. */
export default {
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
