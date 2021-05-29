<template>
  <img v-if="!$fetchState.pending && src" class="my-4" :src="src" />
</template>

<script>
import { DrupalJsonApiParams } from 'drupal-jsonapi-params'

export default {
  data: () => ({
    media: false,
  }),

  async fetch() {
    const { type } = this.$attrs.value.relationships.field_media.data
    this.media = await this.$store.dispatch('druxt/getResource', {
      ...this.$attrs.value.relationships.field_media.data,
      query: new DrupalJsonApiParams()
        .addInclude('field_media_image')
        .addFields(type, [])
        .addFields('file--file', ['uri']),
    })
  },

  computed: {
    src: ({ media }) =>
      ((((media.included || [])[0] || {}).attributes || {}).uri || {}).url,
  },
}
</script>
