<template>
  <AppHomeFeature v-bind="$props" />
</template>

<script>
// Canvas passes each input in camel case. One an editor left empty is left
// out, so the wrapped component's own default applies.
export default {
  props: {
    icon: { type: String, default: undefined },
    heading: { type: String, default: undefined },
    text: { type: String, default: undefined },
    linkText: { type: String, default: undefined },
    linkUrl: { type: String, default: undefined },
  },
}
</script>
