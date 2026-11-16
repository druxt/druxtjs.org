<template>
  <AppHomeHero v-bind="$props">
    <template #actions><slot name="actions" /></template>
    <slot name="content" />
  </AppHomeHero>
</template>

<script>
// Canvas passes each input in camel case. One an editor left empty is left
// out, so the wrapped component's own default applies.
export default {
  props: {
    heading: { type: String, default: undefined },
    lead: { type: String, default: undefined },
    note: { type: String, default: undefined },
    noteLinkText: { type: String, default: undefined },
    noteLinkUrl: { type: String, default: undefined },
  },
}
</script>
