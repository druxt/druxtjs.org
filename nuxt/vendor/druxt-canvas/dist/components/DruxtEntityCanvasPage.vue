<script>

/**
 * Renders a Canvas page entity in any view mode but `full` as its title,
 * linked to the page.
 *
 * Canvas pages have no view displays in Drupal, so a view or a reference that
 * lists them gets this. The `full` mode renders the Canvas tree, through
 * `DruxtEntityCanvasPageFull`.
 *
 * To render a listed Canvas page differently, create a more specific
 * DruxtEntity wrapper, such as `DruxtEntityCanvasPageCanvasPageTeaser`.
 *
 * _This component is intended to be rendered by the `<DruxtEntity />` component._
 */
export default {
  name: 'DruxtEntityCanvasPage',

  inheritAttrs: false,

  /** */
  props: {
    /**
     * The Canvas page JSON:API resource.
     *
     * @type {object}
     */
    entity: {
      type: Object,
      required: true,
    },
  },

  computed: {
    /**
     * The page path: its alias, or its Drupal path.
     *
     * @type {string|false}
     */
    path: ({ entity }) => {
      const attributes = entity.attributes || {}
      if ((attributes.path || {}).alias) return attributes.path.alias
      return attributes.drupal_internal__id
        ? `/page/${attributes.drupal_internal__id}`
        : false
    },

    /**
     * The page title.
     *
     * @type {string}
     */
    title: ({ entity }) => (entity.attributes || {}).title || '',
  },

  render(h) {
    return h('article', { attrs: { 'data-canvas-page': this.entity.id } }, [
      h('h2', [
        this.path
          ? h('NuxtLink', { props: { to: this.path } }, [this.title])
          : this.title,
      ]),
    ])
  },
}
</script>
