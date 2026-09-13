<template>
  <!-- The image itself, with the alt text its media reference carries. AppProse turns it into a figure. -->
  <img v-if="src" :src="src" :alt="alt">
</template>

<script>
/**
 * A media image: the file it holds, as a plain image. The alt text is set
 * on the media entity's reference to the file, so the wrapper reads the
 * file itself rather than handing the field to a formatter that cannot.
 */
export default {
  // Every DruxtEntity prop is declared, so none leaks as an attribute. Not
  // `inheritAttrs: false`: that would also drop the data-fetch-key Nuxt
  // stamps on the root, and the browser would run fetch() again.
  props: {
    entity: { type: Object, default: () => ({}) },
    fields: { type: [Object, Boolean], default: undefined },
    schema: { type: Object, default: undefined },
    value: { type: Object, default: undefined },
  },
  data: () => ({ file: null }),
  async fetch() {
    const { type, id } = this.ref
    if (!id) return
    this.file = await this.$store.dispatch('druxt/getResource', { type, id }).then((r) => (r || {}).data || null, () => null)
  },
  computed: {
    ref: ({ entity }) => (((entity.relationships || {}).field_media_image || {}).data) || {},
    alt: ({ ref }) => (ref.meta || {}).alt || '',
    src: ({ file }) => (((file || {}).attributes || {}).uri || {}).url || '',
  },
}
</script>
