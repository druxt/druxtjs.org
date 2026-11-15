<template>
  <AppHomeModules v-bind="inputs" />
</template>

<script>
import { DruxtCanvasComponentMixin } from '@druxt-contrib/canvas'

export default {
  mixins: [DruxtCanvasComponentMixin],

  props: {
    heading: { type: String, default: '' },
    text: { type: String, default: '' },
    linkText: { type: String, default: '' },
    linkUrl: { type: String, default: '/modules' },
  },

  computed: {
    // The declared inputs, without the mixin's `canvas` prop.
    inputs: ({ $props: { canvas, ...inputs } }) => inputs,
  },
}
</script>
