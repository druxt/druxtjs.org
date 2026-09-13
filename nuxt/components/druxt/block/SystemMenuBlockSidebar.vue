<template>
  <div>
    <DruxtMenu :name="menu" :depth="depth" variant="sidebar" />
  </div>
</template>

<script>
import { menuBlock } from '~/utils/menu'

/** A menu block placed in the sidebar: the tree, with the active section open. */
export default {
  props: {
    block: { type: Object, required: true },
  },
  computed: menuBlock,
}
</script>
