<template>
  <DruxtMenu :name="menu" :depth="depth" />
</template>

<script>
import { menuBlock } from '~/utils/menu'

/** A menu block placed in the footer. */
export default {
  props: {
    block: { type: Object, required: true },
  },
  computed: menuBlock,
}
</script>
