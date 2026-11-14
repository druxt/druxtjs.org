<script>

import {
  DruxtCanvasComponentMixin,
  hasComponent,
  renderBlock,
  renderDebug,
} from '@druxt-contrib/canvas'

/**
 * Renders Canvas's views block, `block.views_block.<view>-<display>`, as a
 * DruxtView component.
 *
 * The view and display ids come from the component id. The block's
 * `views_label` replaces the view's title when set. Its `items_per_page`
 * override is not applied: DruxtView reads the display's own pager.
 *
 * Registered only when druxt-views is installed. To render one view
 * differently, create a more specific wrapper, such as
 * `DruxtCanvasBlockViewsBlockRecentPagesBlockRecentPages`.
 *
 * _This component is intended to be rendered by the `<DruxtCanvasComponent />` component._
 */
export default {
  name: 'DruxtCanvasBlockViewsBlock',

  mixins: [DruxtCanvasComponentMixin],

  /** */
  props: {
    /** @type {string} */
    label: { type: String, default: '' },
    /** @type {string} */
    labelDisplay: { type: String, default: '0' },
    /** @type {string} */
    langcode: { type: String, default: undefined },
    /** @type {string} */
    viewsLabel: { type: String, default: '' },
  },

  computed: {
    /**
     * The view and display ids, from the Canvas component id.
     *
     * @type {object}
     */
    ids: ({ canvas }) => {
      const match = /^block\.views_block\.([^.]+?)-([^.]+)$/.exec(
        String(canvas.componentId || '')
      )
      return match ? { viewId: match[1], displayId: match[2] } : false
    },
  },

  render(h) {
    if (!hasComponent(this, 'DruxtView')) {
      return renderDebug(
        h,
        'The Canvas views block needs druxt-views.',
        this.canvas.uuid
      )
    }
    if (!this.ids) {
      return renderDebug(
        h,
        `The Canvas component id "${this.canvas.componentId}" names no view and display.`,
        this.canvas.uuid
      )
    }

    return renderBlock(h, {
      content: h('DruxtView', {
        props: { ...this.ids, langcode: this.langcode },
      }),
      label: this.viewsLabel || this.label,
      labelDisplay: this.labelDisplay,
      uuid: this.canvas.uuid,
    })
  },
}
</script>
