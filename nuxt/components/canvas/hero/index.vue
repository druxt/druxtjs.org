<template>
  <AppHomeHero :heading="heading" :lead="lead" :note="note">
    <template #actions><slot name="actions" /></template>
    <slot name="content" />
  </AppHomeHero>
</template>

<script>
export default {
  props: {
    heading: { type: String, default: '' },
    lead: { type: String, default: '' },
    note: { type: String, default: '' },
  },
}
</script>
