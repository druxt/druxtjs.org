<template>
  <div class="flex items-center gap-3 min-w-0">
    <slot v-for="block in blocks" :name="block.attributes.drupal_internal__id" />
  </div>
</template>

<script>
/** The header region's blocks, in the order Drupal places them, in a row. */
export default {
  props: {
    blocks: { type: Array, default: () => [] },
    name: { type: String, default: undefined },
    theme: { type: String, default: undefined },
  },
}
</script>
