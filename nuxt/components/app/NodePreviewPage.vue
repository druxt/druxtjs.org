<template>
  <article class="druxt-node-preview" :data-view-mode="viewMode" :data-entity-uuid="entity && entity.id">
    <template v-if="error">
      <AppPageHeader title="Preview unavailable" />
      <p class="px-6 text-sm text-red-700">{{ error }}</p>
    </template>
    <template v-else-if="entity">
      <AppPageHeader :title="title" :description="description" />
      <AppProse :key="entity.id" :title="title">
        <DruxtEntity :key="entity.id" :mode="viewMode" :type="entity.type" :uuid="entity.id" />
      </AppProse>
    </template>
    <p v-else class="px-6 text-sm text-slate-500">Loading preview…</p>
  </article>
</template>

<script>
/**
 * Drupal's node preview, rendered as the site renders the saved page.
 *
 * The module's page draws the entity alone. This one reads the endpoint,
 * fetches and seeds through the module's plugin as that page does, and wraps
 * the entity in the page header and prose shell that
 * components/app/SectionDocument.vue gives a saved page, so an editor
 * previews what readers will see. It takes the module's route in
 * nuxt.config.js. Browser only: the endpoint lives in the URL fragment.
 */
export default {
  name: 'AppNodePreviewPage',

  data: () => ({
    /** The previewed resource, `{ type, id }`, once seeded. */
    entity: null,
    error: null,
    /** The previewed node's attributes, for the header. */
    attributes: {},
  }),

  computed: {
    viewMode() {
      return this.$route.query.vm || 'full'
    },
    title() {
      return this.attributes.title || 'Preview'
    },
    description() {
      return this.attributes.field_description || null
    },
  },

  async mounted() {
    const endpoint = this.$druxtNodePreview.endpoint()
    if (!endpoint) {
      this.error = 'No preview endpoint was provided in the URL fragment.'
      return
    }
    try {
      const doc = await this.$druxtNodePreview.fetch(endpoint)
      this.attributes = (doc.data && doc.data.attributes) || {}
      this.entity = this.$druxtNodePreview.seed(doc)
    } catch (error) {
      this.error = error.message
    }
  },
}
</script>
