<script>

import {
  DruxtCanvasComponentMixin,
  hasComponent,
  renderBlock,
  renderDebug,
} from '@druxt-contrib/canvas'

/**
 * Renders Canvas's menu block, `block.system_menu_block.<menu>`, as a
 * DruxtMenu component.
 *
 * The block's settings map to DruxtMenu props: the menu name comes from the
 * component id and `depth` is passed on (0 is every level, as in Drupal).
 * A block that starts below the first level (`level` above 1) is not
 * rendered, as DruxtMenu has no active trail root.
 *
 * Registered only when druxt-menu is installed. To render one menu
 * differently, create `DruxtCanvasBlockSystemMenuBlock<Menu>`, such as
 * `DruxtCanvasBlockSystemMenuBlockMain`.
 *
 * _This component is intended to be rendered by the `<DruxtCanvasComponent />` component._
 */
export default {
  name: 'DruxtCanvasBlockSystemMenuBlock',

  mixins: [DruxtCanvasComponentMixin],

  /** */
  props: {
    /** @type {number} */
    depth: { type: Number, default: 0 },
    /** @type {string} */
    label: { type: String, default: '' },
    /** @type {string} */
    labelDisplay: { type: String, default: '0' },
    /** @type {string} */
    langcode: { type: String, default: undefined },
    /** @type {number} */
    level: { type: Number, default: 1 },
  },

  computed: {
    /**
     * The menu machine name, from the Canvas component id.
     *
     * @type {string}
     */
    name: ({ canvas }) =>
      String(canvas.componentId || '')
        .split('.')
        .slice(2)
        .join('.'),
  },

  render(h) {
    if (!hasComponent(this, 'DruxtMenu')) {
      return renderDebug(
        h,
        `The Canvas menu block "${this.name}" needs druxt-menu.`,
        this.canvas.uuid
      )
    }
    if (this.level > 1) {
      return renderDebug(
        h,
        `The Canvas menu block "${this.name}" starts at level ${this.level}, which DruxtMenu cannot render. Create a wrapper component for it.`,
        this.canvas.uuid
      )
    }

    return renderBlock(h, {
      content: h('DruxtMenu', {
        props: { depth: this.depth, langcode: this.langcode, name: this.name },
      }),
      label: this.label,
      labelDisplay: this.labelDisplay,
      uuid: this.canvas.uuid,
    })
  },
}
</script>
