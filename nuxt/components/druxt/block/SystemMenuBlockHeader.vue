<template>
  <!-- The inline section nav needs ~1280px before it stops wrapping. -->
  <nav class="hidden xl:block min-w-0">
    <DruxtMenu :name="menu" :depth="depth" variant="horizontal" />
  </nav>
</template>

<script>
import { menuBlock } from '~/utils/menu'

/** A menu block placed in the header: one row of links. */
export default {
  props: {
    block: { type: Object, required: true },
  },
  computed: menuBlock,
}
</script>
