<script>

/**
 * Renders a Canvas page entity in the `full` view mode as a DruxtCanvas
 * component.
 *
 * DruxtRouter renders an entity route as DruxtEntity in the `full` mode, so a
 * Canvas page reached by its path, the front page included, renders its
 * Canvas tree. The resource DruxtEntity fetched is handed on, so the page is
 * not requested twice.
 *
 * Other view modes, such as a view's rows, render through
 * `DruxtEntityCanvasPage`, as a link, so a page listed by a view it contains
 * does not render itself.
 *
 * To render a Canvas page differently, create a more specific DruxtEntity
 * wrapper, such as `DruxtEntityCanvasPageCanvasPageFull`.
 *
 * _This component is intended to be rendered by the `<DruxtEntity />` component._
 */
export default {
  name: 'DruxtEntityCanvasPageFull',

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

  render(h) {
    return h('DruxtCanvas', {
      props: {
        langcode: this.$attrs.langcode,
        type: this.entity.type,
        uuid: this.entity.id,
        value: this.entity,
      },
    })
  },
}
</script>
