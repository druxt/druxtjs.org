<template>
  <div
    class="druxt-node-preview"
    :data-view-mode="viewMode"
    :data-entity-type="entity && entity.type"
    :data-entity-uuid="entity && entity.id"
  >
    <div
      v-if="error"
      class="druxt-node-preview-error"
    >
      <h1>Preview unavailable</h1>
      <p>{{ error }}</p>
    </div>

    <DruxtNodePreview
      v-else-if="document"
      :key="entity.id"
      :document="document"
      :mode="viewMode"
    />

    <p v-else>
      Loading preview…
    </p>
  </div>
</template>

<script>
import DruxtNodePreview from './druxt-node-preview.vue'

/**
 * Renders a Drupal node preview.
 *
 * This page only works in the browser. The preview endpoint arrives in the
 * URL fragment, which never reaches the server, and the fetch uses the
 * editor's Drupal session cookie. A server render shows "Loading preview…".
 */
export default {
  name: 'DruxtNodePreviewPage',

  components: { DruxtNodePreview },

  /**
   * The layout named by `?layout=`, when the `layouts` option lists it.
   *
   * @param {object} context - The Nuxt context.
   *
   * @returns {string|undefined} The layout, or undefined for the default.
   */
  layout: ({ $druxtNodePreview, route }) => $druxtNodePreview.layout(route.query.layout),

  data: () => ({
    document: null,
    entity: null,
    error: null,
  }),

  computed: {
    viewMode() {
      return this.$route.query.vm || 'full'
    },
  },

  async mounted() {
    // A statically generated site renders this page once, with no query, and
    // Nuxt keeps that layout in the browser. So the listed layout is set here
    // as well, where the query is known.
    const layout = this.$druxtNodePreview.layout(this.$route.query.layout)
    if (layout && this.$nuxt && this.$nuxt.layoutName !== layout) {
      await this.$nuxt.loadLayout(layout)
      this.$nuxt.setLayout(layout)
    }

    try {
      const endpoint = this.$druxtNodePreview.endpoint()
      if (!endpoint) {
        this.error = 'No preview endpoint was provided in the URL fragment.'
        return
      }
      const document = await this.$druxtNodePreview.fetch(endpoint)
      this.entity = this.$druxtNodePreview.seed(document)
      this.document = document
    }
    catch (error) {
      this.error = error.message
    }
  },
}
</script>
