<template>
  <AppHomeQuickstartCommand v-bind="$props" />
</template>

<script>
// Canvas passes each input in camel case. One an editor left empty is left
// out, so the wrapped component's own default applies.
export default {
  props: {
    commands: { type: Array, default: undefined },
    starterKits: { type: Array, default: undefined },
  },
}
</script>
