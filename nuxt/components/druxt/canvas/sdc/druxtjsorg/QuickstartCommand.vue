<template>
  <AppHomeQuickstartCommand v-bind="inputs" />
</template>

<script>
import { DruxtCanvasComponentMixin } from '@druxt-contrib/canvas'

export default {
  mixins: [DruxtCanvasComponentMixin],

  props: {
    commands: { type: Array, default: undefined },
    starterKits: { type: Array, default: undefined },
  },

  computed: {
    // The lists an editor has set, so an empty one leaves the component's own.
    inputs: ({ commands, starterKits }) => ({
      ...(commands && commands.length ? { commands } : {}),
      ...(starterKits && starterKits.length ? { starterKits } : {}),
    }),
  },
}
</script>
