<template>
  <div>
    <div
      class="
        bg-center bg-cover bg-gradient-to-bl
        border-b
        flex flex-col
        from-green-500
        h-100
        opacity-90
        justify-end
        text-white
        to-blue-500
      "
      :style="{ backgroundImage: src ? `url(${src})` : false }"
    >
      <div class="bg-gradient-to-t from-black to-transparent">
        <div class="container mb-10 mt-50 mx-auto">
          <h2
            class="bg-black bg-opacity-50 inline-block px-2 py-1 text-size-4xl"
          >
            {{ $attrs.entity.attributes.title }}
          </h2>
          <div>
            <p
              class="
                bg-black bg-opacity-40
                inline-block
                ml-2
                mt-1
                px-2
                py-1
                text-sm
              "
              v-html="changed"
            />
          </div>
          <div>
            <p
              class="bg-black bg-opacity-40 inline-block my-4 px-2 py-1"
              v-html="$attrs.entity.attributes.field_description.processed"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="mt-10">
      <DruxtEntity
        v-for="include of (blog.included || []).filter((o) => o)"
        :class="classes[include.type.split('--')[1]] || []"
        :key="include.id"
        :type="include.type"
        :uuid="include.id"
      />
    </div>
  </div>
</template>

<script>
import { DrupalJsonApiParams } from 'drupal-jsonapi-params'

export default {
  data: () => ({
    blog: false,
    media: false,
  }),

  async fetch() {
    if (
      this.$attrs.entity.relationships.field_content.data &&
      this.$attrs.mode !== 'teaser'
    ) {
      this.blog = await this.$store.dispatch('druxt/getResource', {
        type: this.$attrs.entity.type,
        id: this.$attrs.entity.id,
        query: new DrupalJsonApiParams()
          .addFields(this.$attrs.entity.type, [
            'changed',
            'field_description',
            'title',
          ])
          .addInclude('field_content'),
      })
    }

    if (this.$attrs.entity.relationships.field_image.data) {
      const { type } = this.$attrs.value.relationships.field_image.data
      this.media = await this.$store.dispatch('druxt/getResource', {
        ...this.$attrs.value.relationships.field_image.data,
        query: new DrupalJsonApiParams()
          .addInclude('field_media_image')
          .addFields(type, [])
          .addFields('file--file', ['uri']),
      })
    }
  },

  computed: {
    changed: ({ $attrs, $dateFns }) =>
      $dateFns.format(
        new Date($attrs.entity.attributes.changed),
        'MMM dd, yyyy'
      ),

    classes: () => ({
      code: ['my-8'],
      text_markdown: ['container', 'mb-4', 'mx-auto'],
    }),

    src: ({ media }) =>
      ((((media.included || [])[0] || {}).attributes || {}).uri || {}).url,
  },
}
</script>
