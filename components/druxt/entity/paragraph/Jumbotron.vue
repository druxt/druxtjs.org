<template>
  <div
    class="
      border-b-1
      bg-gradient-to-bl
      from-gray-200
      text-black
      to-blue-gray-200
    "
  >
    <div class="container flex flex-col mx-auto p-10 text-center">
      <DruxtEntity
        v-if="media"
        class="w-50 mx-auto"
        :uuid="media.id"
        :type="media.type"
      />

      <h2 class="text-5xl mb-3">{{ $attrs.entity.attributes.field_title }}</h2>

      <DruxtEntity
        v-if="text"
        class="text-xl mx-auto sm:w-100"
        :uuid="text.id"
        :type="text.type"
      />

      <DruxtEntity v-if="link" :uuid="link.id" :type="link.type" />
    </div>
  </div>
</template>

<script>
import { DrupalJsonApiParams } from 'drupal-jsonapi-params'

export default {
  data: () => ({
    jumbotron: false,
  }),

  async fetch() {
    const { type, id } = this.$attrs.entity
    this.jumbotron = await this.$store.dispatch('druxt/getResource', {
      type,
      id,
      query: new DrupalJsonApiParams()
        .addFields(type, [])
        .addInclude(['field_content']),
    })
  },

  computed: {
    text: ({ jumbotron }) =>
      ((jumbotron || {}).included || []).filter(
        (o) => o && o.type.startsWith('paragraph--text_')
      )[0] || false,

    link: ({ jumbotron }) =>
      ((jumbotron || {}).included || []).filter(
        (o) => o && o.type === 'paragraph--link'
      )[0] || false,

    media: ({ jumbotron }) =>
      ((jumbotron || {}).included || []).filter(
        (o) => o && o.type === 'paragraph--media'
      )[0] || false,
  },
}
</script>
