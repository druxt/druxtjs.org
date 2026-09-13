<template>
  <div class="grid gap-8">
    <slot v-for="block in blocks" :name="block.attributes.drupal_internal__id" />
  </div>
</template>

<script>
/** The footer region's blocks, in the order Drupal places them. */
export default {
  props: {
    blocks: { type: Array, default: () => [] },
    name: { type: String, default: undefined },
    theme: { type: String, default: undefined },
  },
}
</script>
