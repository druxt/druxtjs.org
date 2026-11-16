<template>
  <AppHomeAction v-bind="$props" />
</template>

<script>
// Canvas passes each input in camel case. One an editor left empty is left
// out, so the wrapped component's own default applies.
export default {
  props: {
    label: { type: String, default: undefined },
    url: { type: String, default: undefined },
    variant: { type: String, default: undefined },
    icon: { type: String, default: undefined },
  },
}
</script>
