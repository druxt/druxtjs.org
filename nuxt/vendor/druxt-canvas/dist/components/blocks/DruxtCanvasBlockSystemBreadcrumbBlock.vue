<script>

import {
  DruxtCanvasComponentMixin,
  hasComponent,
  renderBlock,
  renderDebug,
} from '@druxt-contrib/canvas'

/**
 * Renders Canvas's breadcrumb block, `block.system_breadcrumb_block`, as a
 * DruxtBreadcrumb component, which builds the trail from the current route.
 *
 * Registered only when druxt-breadcrumb is installed.
 *
 * _This component is intended to be rendered by the `<DruxtCanvasComponent />` component._
 */
export default {
  name: 'DruxtCanvasBlockSystemBreadcrumbBlock',

  mixins: [DruxtCanvasComponentMixin],

  /** */
  props: {
    /** @type {string} */
    label: { type: String, default: '' },
    /** @type {string} */
    labelDisplay: { type: String, default: '0' },
    /** @type {string} */
    langcode: { type: String, default: undefined },
  },

  render(h) {
    if (!hasComponent(this, 'DruxtBreadcrumb')) {
      return renderDebug(
        h,
        'The Canvas breadcrumb block needs druxt-breadcrumb.',
        this.canvas.uuid
      )
    }

    return renderBlock(h, {
      content: h('DruxtBreadcrumb', { props: { langcode: this.langcode } }),
      label: this.label,
      labelDisplay: this.labelDisplay,
      uuid: this.canvas.uuid,
    })
  },
}
</script>
