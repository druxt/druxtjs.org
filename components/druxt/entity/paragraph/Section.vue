<template>
  <div
    v-if="!$fetchState.pending"
    class="border-b container mx-auto my-4 py-4 text-center"
  >
    <h2 class="text-2xl">{{ $attrs.entity.attributes.field_title }}</h2>
    <div class="text-sm text-gray-700 my-8">
      <DruxtEntity v-if="media" :uuid="media.id" :type="media.type" />
      <DruxtEntity
        v-if="text"
        class="sm:w-150 mx-auto"
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
    section: false,
  }),

  async fetch() {
    const { type, id } = this.$attrs.entity
    this.section = await this.$store.dispatch('druxt/getResource', {
      type,
      id,
      query: new DrupalJsonApiParams()
        .addFields(type, [])
        .addInclude(['field_content']),
    })
  },

  computed: {
    text: ({ section }) =>
      ((section || {}).included || []).filter(
        (o) => o && o.type.startsWith('paragraph--text_')
      )[0] || false,

    link: ({ section }) =>
      ((section || {}).included || []).filter(
        (o) => o && o.type === 'paragraph--link'
      )[0] || false,

    media: ({ section }) =>
      ((section || {}).included || []).filter(
        (o) => o && o.type === 'paragraph--media'
      )[0] || false,
  },
}
</script>
