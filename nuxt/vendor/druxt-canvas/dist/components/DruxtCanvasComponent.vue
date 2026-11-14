<script>

import DruxtModule from 'druxt/dist/components/DruxtModule.vue'
import { getComponentParts } from '@druxt-contrib/canvas'

/**
 * The prefix of every Canvas component wrapper name.
 *
 * @type {string}
 */
const PREFIX = 'DruxtCanvas'

/**
 * The DruxtCanvasComponent component renders one Canvas component instance
 * through a Druxt wrapper component chosen by its Canvas component id.
 *
 * _It is rendered by `<DruxtCanvas />` for each instance in the page's tree,
 * and is not intended to be used directly._
 *
 * - The instance's inputs are the wrapper's props, in camelCase.
 * - Each Canvas slot is a scoped slot of the same name.
 * - The `default` slot is the component's default output: the content of
 *   every Canvas slot, in order. A wrapper for a component with a Canvas slot
 *   named `default` gets that slot alone.
 * - Without a wrapper, the default output is rendered, as with any Druxt
 *   module. A component with no slots has no default output, so development
 *   shows Druxt's debug message naming the wrapper components to create, and
 *   production renders an empty element.
 *
 * @example <caption>DruxtCanvas**Source**[**Provider**][**Name**].vue</caption> @lang vue
 * <template>
 *   <section>
 *     <h2>{{ headingText }}</h2>
 *     <slot name="main_slot" />
 *   </section>
 * </template>
 *
 * <script>
 * import { DruxtCanvasComponentMixin } from '@druxt-contrib/canvas'
 * export default {
 *   mixins: [DruxtCanvasComponentMixin],
 *   props: { headingText: { type: String, default: '' } },
 * }
 */
export default {
  name: 'DruxtCanvasComponent',

  extends: DruxtModule,

  /** */
  props: {
    /**
     * The component instance, a node of the tree `buildCanvasTree()` returns.
     *
     * @type {CanvasNode}
     */
    item: {
      type: Object,
      required: true,
    },
  },

  methods: {
    /**
     * Gets the wrapper component options, named from `DruxtCanvas` rather than
     * from this component's own name, so a wrapper reads as the Canvas
     * component it renders: `DruxtCanvasSdcMercuryHeading`.
     *
     * @returns {object[]} The wrapper component options.
     */
    getModuleComponents() {
      const name = this.$options.name
      this.$options.name = PREFIX
      try {
        return DruxtModule.methods.getModuleComponents.call(this)
      } finally {
        this.$options.name = name
      }
    },
  },

  /** DruxtModule settings */
  druxt: {
    /**
     * Provides the wrapper component options from the Canvas component id.
     *
     * @param {object} context - The module component ViewModel.
     * @param {CanvasNode} context.item - The component instance.
     * @returns {ComponentOptions}
     */
    componentOptions: ({ item }) => [
      getComponentParts((item || {}).componentId),
      ['default'],
    ],

    /**
     * Provides propsData for the wrapper: the instance's inputs in camelCase,
     * and `canvas`, the instance itself.
     *
     * @param {object} context - The module component ViewModel.
     * @param {CanvasNode} context.item - The component instance.
     * @returns {PropsData}
     */
    propsData: ({ item }) => ({
      ...((item || {}).props || {}),
      canvas: {
        componentId: (item || {}).componentId,
        componentVersion: (item || {}).componentVersion,
        inputs: (item || {}).inputs,
        label: (item || {}).label,
        slots: Object.keys((item || {}).slots || {}),
        uuid: (item || {}).uuid,
      },
    }),

    /**
     * Provides a scoped slot for each Canvas slot, and the `default` slot.
     *
     * The `default` slot is the default output, every Canvas slot in order,
     * so a component without a wrapper renders its children, as DruxtEntity
     * renders its fields. A component with no Canvas slots has no default
     * output and provides no `default` slot, which leaves DruxtModule to show
     * its debug message in development.
     *
     * @param {Function} h - The Vue createElement function.
     * @return {ScopedSlots} The scoped slots object.
     */
    slots(h) {
      const slots = {}

      for (const [name, children] of Object.entries(
        (this.item || {}).slots || {}
      )) {
        slots[name] = (attrs) =>
          children.map((child) =>
            h('DruxtCanvasComponent', {
              attrs,
              key: child.uuid,
              props: { item: child, langcode: this.langcode },
            })
          )
      }

      const names = Object.keys(slots)
      if (!names.length) {
        return slots
      }

      // A wrapper renders the Canvas slot named `default` by that name, and
      // the others by theirs. Without a wrapper, the default output holds
      // them all.
      const hasWrapper = this.component.is !== 'DruxtWrapper'
      if (!(hasWrapper && slots.default)) {
        const content = { ...slots }
        slots.default = (attrs) => names.flatMap((name) => content[name](attrs))
      }

      return slots
    },
  },
}

/**
 * Provides the available naming options for the wrapper component.
 *
 * @typedef {array[]} ComponentOptions
 *
 * @example @lang js
 * [
 *   'DruxtCanvas[Source][Provider][Name]',
 *   'DruxtCanvas[Source][Provider]',
 *   'DruxtCanvas[Source]',
 *   'DruxtCanvasDefault',
 * ]
 *
 * @example <caption>sdc.mercury.heading</caption> @lang js
 * [
 *   'DruxtCanvasSdcMercuryHeading',
 *   'DruxtCanvasSdcMercury',
 *   'DruxtCanvasSdc',
 *   'DruxtCanvasDefault',
 * ]
 */

/**
 * Provides property data for use in the wrapper component.
 *
 * @typedef {object} PropsData
 * @param {*} * - Each input, by its camelCase name.
 * @param {object} canvas - The instance: `uuid`, `componentId`, `componentVersion`, `label`, `inputs` (by their Canvas names) and `slots` (the slot names).
 *
 * @example <caption>sdc.mercury.heading</caption> @lang js
 * {
 *   headingText: 'Druxt meets Canvas',
 *   level: 1,
 *   textSize: 'heading-responsive-7xl',
 *   textColor: 'default',
 *   align: 'left',
 *   canvas: {
 *     componentId: 'sdc.mercury.heading',
 *     uuid: '9fa5f3f0-1958-4f20-81b5-e5b708cb3f7e',
 *   },
 * }
 */

/**
 * Provides scoped slots for use in the wrapper component.
 *
 * @typedef {object} ScopedSlots
 * @param {function} * - Slot per Canvas slot.
 * @param {function} default - Every Canvas slot in turn, or for a wrapper, the Canvas slot named `default`.
 */
</script>
