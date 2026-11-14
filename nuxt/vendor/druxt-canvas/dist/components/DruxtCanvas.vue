<script>

import DruxtModule from 'druxt/dist/components/DruxtModule.vue'
import { mapActions } from 'vuex'
import { buildCanvasTree, getHead } from '@druxt-contrib/canvas'

/**
 * The DruxtCanvas component renders a Drupal Canvas page from its JSON:API
 * resource.
 *
 * The page's `components` field is built into a tree, and each component
 * instance is rendered by `<DruxtCanvasComponent />` through a wrapper
 * component named after its Canvas component id.
 *
 * The page's title and meta tags come from its `metatag` field when the page
 * is the current route, or when the `metatags` prop is `true`.
 *
 * @example @lang vue
 * <DruxtCanvas uuid="efff9394-e546-4d64-98e8-295c92367d52" />
 *
 * @example <caption>With an already fetched resource</caption> @lang vue
 * <DruxtCanvas :value="resource" />
 *
 * @example <caption>DruxtCanvas wrapper component boilerplate</caption> @lang vue
 * <template>
 *   <main>
 *     <h1>{{ entity.attributes.title }}</h1>
 *     <slot />
 *   </main>
 * </template>
 *
 * <script>
 * export default {
 *   props: {
 *     entity: { type: Object, required: true },
 *     tree: { type: Array, default: () => [] },
 *   },
 * }
 */
export default {
  name: 'DruxtCanvas',

  extends: DruxtModule,

  /** */
  props: {
    /**
     * Whether to set the page title and meta tags from the `metatag` field.
     *
     * By default they are set only when the page is the current route's entity.
     *
     * @type {boolean}
     */
    metatags: {
      type: Boolean,
      default: undefined,
    },

    /**
     * JSON:API resource type.
     *
     * @type {string}
     * @default canvas_page--canvas_page
     */
    type: {
      type: String,
      default: 'canvas_page--canvas_page',
    },

    /**
     * The page UUID. Not needed when the resource is given as `value`.
     *
     * @type {string}
     */
    uuid: {
      type: String,
      default: undefined,
    },
  },

  fetchKey(getCounter) {
    const parts = [
      'DruxtCanvas',
      this.type,
      this.uuid || (this.value || {}).id,
    ].filter((o) => o)
    return [...parts, getCounter(parts.join(':'))].join(':')
  },

  /**
   * Nuxt head method: the title, meta and link tags from the `metatag` field.
   *
   * @returns {object} The head object.
   */
  head() {
    if (!this.setsHead) return {}
    return getHead(((this.entity || {}).attributes || {}).metatag)
  },

  computed: {
    /**
     * The JSON:API resource of the page.
     *
     * @type {object}
     */
    entity: ({ model }) => model || {},

    /**
     * The page's component tree.
     *
     * @type {CanvasNode[]}
     */
    tree() {
      if (this.isRecursive) {
        this.warn(
          `[druxt-canvas] Not rendering ${this.type} ${this.entity.id} inside itself.`
        )
        return []
      }

      return buildCanvasTree(
        ((this.entity || {}).attributes || {}).components,
        {
          warn: ({ reason, item }) =>
            this.warn(
              `[druxt-canvas] Left out component instance ${(item || {}).uuid} (${reason}) of ${this.type} ${this.entity.id}.`
            ),
        }
      )
    },

    /**
     * Whether a DruxtCanvas above this one renders the same page, as when a
     * page holds a view that lists it. The tree is then not rendered, as it
     * would hold itself without end.
     *
     * @type {boolean}
     */
    isRecursive() {
      if (!this.entity.id) return false
      for (let parent = this.$parent; parent; parent = parent.$parent) {
        if (
          parent.$options.name === 'DruxtCanvas' &&
          (parent.entity || {}).id === this.entity.id
        )
          return true
      }
      return false
    },

    /**
     * Whether the page sets the document head.
     *
     * @type {boolean}
     */
    setsHead() {
      if (this.isRecursive) return false
      if (typeof this.metatags === 'boolean') return this.metatags

      const route =
        ((this.$store && this.$store.state.druxtRouter) || {}).route || {}
      return !!this.entity.id && (route.props || {}).uuid === this.entity.id
    },
  },

  watch: {
    type() {
      this.$fetch()
    },

    uuid() {
      this.$fetch()
    },
  },

  methods: {
    /**
     * Logs a warning in development.
     *
     * @param {string} message - The warning.
     */
    warn(message) {
      if (this.$nuxt && this.$nuxt.context && this.$nuxt.context.isDev) {
        // eslint-disable-next-line no-console
        console.warn(message)
      }
    },

    /**
     * Maps Vuex actions to methods.
     */
    ...mapActions({
      getResource: 'druxt/getResource',
    }),
  },

  /** DruxtModule settings */
  druxt: {
    /**
     * Provides the wrapper component options from the resource type.
     *
     * @param {object} context - The module component ViewModel.
     * @param {string} context.type - The JSON:API resource type.
     * @returns {ComponentOptions}
     */
    componentOptions: ({ type }) => [String(type || '').split('--')],

    /**
     * Fetches the page's JSON:API resource, unless it was given as `value`.
     *
     * Nuxt runs one fetch at a time and answers a second `$fetch()` with the
     * one already running, so a uuid that changes mid-request is fetched here
     * once that request ends. A response for a uuid, language or type that is
     * no longer current is dropped, and so is any response once a `value`
     * has arrived.
     */
    async fetchData() {
      for (;;) {
        if (this.value || !this.uuid) return

        const request = { id: this.uuid, prefix: this.lang, type: this.type }
        const resource = await this.getResource(request)
        if (this.value) return
        if (
          request.id === this.uuid &&
          request.prefix === this.lang &&
          request.type === this.type
        ) {
          this.model = JSON.parse(JSON.stringify((resource || {}).data || {}))
          return
        }
      }
    },

    /**
     * Provides propsData for the wrapper.
     *
     * @param {object} context - The module component ViewModel.
     * @returns {PropsData}
     */
    propsData: ({ entity, tree }) => ({ entity, tree }),

    /**
     * Provides the `default` slot, which renders every root instance, and one
     * slot per root instance, named by its uuid.
     *
     * @param {Function} h - The Vue createElement function.
     * @return {ScopedSlots} The scoped slots object.
     */
    slots(h) {
      const slots = {}
      for (const node of this.tree) {
        slots[node.uuid] = (attrs) =>
          h('DruxtCanvasComponent', {
            attrs,
            key: node.uuid,
            props: { item: node, langcode: this.langcode },
          })
      }
      const roots = { ...slots }
      slots.default = (attrs) =>
        this.tree.map((node) => roots[node.uuid](attrs))
      return slots
    },
  },
}

/**
 * Provides the available naming options for the wrapper component.
 *
 * @typedef {array[]} ComponentOptions
 *
 * @example <caption>canvas_page--canvas_page</caption> @lang js
 * [
 *   'DruxtCanvasCanvasPageCanvasPage',
 *   'DruxtCanvasCanvasPage',
 * ]
 */

/**
 * Provides property data for use in the wrapper component.
 *
 * @typedef {object} PropsData
 * @param {object} entity - The page's JSON:API resource.
 * @param {CanvasNode[]} tree - The page's component tree.
 */

/**
 * Provides scoped slots for use in the wrapper component.
 *
 * @typedef {object} ScopedSlots
 * @param {function} default - Every root component instance, in order.
 * @param {function} * - One root component instance, by its uuid.
 */
</script>
