<template>
  <!-- eslint-disable -->
  <component
    is="props.is"
    v-if="!$fetchState.pending && url"
    class="bg-green-500 p-4 rounded-lg text-xl text-white"
    v-bind="props"
  >
    {{ title }}
  </component>
</template>

<script>
import { DrupalJsonApiParams } from 'drupal-jsonapi-params'

export default {
  data: () => ({
    link: false,
  }),

  async fetch() {
    // Load content.
    if (this.$attrs.entity.relationships.field_link.data) {
      const { type, id } = this.$attrs.entity.relationships.field_link.data
      this.link = await this.$store.dispatch('druxt/getResource', {
        type,
        id,
        query: new DrupalJsonApiParams()
          .addFields('node--page', ['path', 'title'])
          .addFields('linky--linky', ['link']),
      })
    }
  },

  computed: {
    props: ({ url }) =>
      (url || '').charAt(0) === '/'
        ? { to: url, is: 'NuxtLink' }
        : { href: url, is: 'a', target: '_blank' },

    url: ({ link }) =>
      ((link || {}).data || {}).type === 'linky--linky'
        ? ((((link || {}).data || {}).attributes || {}).link || {}).uri || false
        : ((((link || {}).data || {}).attributes || {}).path || {}).alias ||
          false,

    title: ({ link }) =>
      ((link || {}).data || {}).type === 'linky--linky'
        ? ((((link || {}).data || {}).attributes || {}).link || {}).title ||
          false
        : (((link || {}).data || {}).attributes || {}).title || false,
  },
}
</script>
