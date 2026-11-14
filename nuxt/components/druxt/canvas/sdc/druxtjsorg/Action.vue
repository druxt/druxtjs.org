<template>
  <AppHomeAction v-bind="inputs" />
</template>

<script>
import { DruxtCanvasComponentMixin } from '@druxt-contrib/canvas'

export default {
  mixins: [DruxtCanvasComponentMixin],

  props: {
    label: { type: String, default: '' },
    url: { type: String, default: '/' },
    variant: { type: String, default: 'ghost' },
    icon: { type: String, default: 'none' },
  },

  computed: {
    // The declared inputs, without the mixin's `canvas` prop.
    inputs: ({ $props: { canvas, ...inputs } }) => inputs,
  },
}
</script>
