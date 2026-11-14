<template>
  <AppHomeHero v-bind="inputs">
    <template #actions><slot name="actions" /></template>
    <slot name="content" />
  </AppHomeHero>
</template>

<script>
import { DruxtCanvasComponentMixin } from '@druxt-contrib/canvas'

export default {
  mixins: [DruxtCanvasComponentMixin],

  props: {
    heading: { type: String, default: '' },
    lead: { type: String, default: '' },
    note: { type: String, default: '' },
    noteLinkText: { type: String, default: '' },
    noteLinkUrl: { type: String, default: '' },
  },

  computed: {
    // The declared inputs, without the mixin's `canvas` prop.
    inputs: ({ $props: { canvas, ...inputs } }) => inputs,
  },
}
</script>
