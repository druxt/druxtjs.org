<template>
  <div :class="{ 'docs-diagram-row': row }">
    <slot />
  </div>
</template>

<script>
/** Content laid out in columns. A `row` of diagrams sits side by side as cards. */
export default {
  props: {
    row: { type: Boolean, default: false },
  },
}
</script>

<style>
/* Each column is a div around its card; let the card fill the column's height. */
.docs-diagram-row > div {
  display: flex;
}
.docs-diagram-row > div > .docs-diagram {
  flex: 1;
}
</style>
