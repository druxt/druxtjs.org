<template>
  <AppHomeFeature v-bind="inputs" />
</template>

<script>
import { DruxtCanvasComponentMixin } from '@druxt-contrib/canvas'

export default {
  mixins: [DruxtCanvasComponentMixin],

  props: {
    icon: { type: String, default: 'none' },
    heading: { type: String, default: '' },
    text: { type: String, default: '' },
    linkText: { type: String, default: '' },
    linkUrl: { type: String, default: '' },
  },

  computed: {
    // The declared inputs, without the mixin's `canvas` prop.
    inputs: ({ $props: { canvas, ...inputs } }) => inputs,
  },
}
</script>
