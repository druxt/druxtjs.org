/**
 * Renders the json-render document Canvas's content API answers with.
 *
 * In a draft session each component, slot and region sits between two
 * comment markers, which the editor selects and drags by. Vue 2 has no
 * fragments, so the whole document renders in one render function, where a
 * list of children may hold comment nodes beside the components.
 *
 * Canvas's own Vue renderer, @drupal-canvas/json-render-vue, is for Vue 3.
 * This draws the same document the same way.
 */
import { MARKER, MARKUP, REGION, SLOT_PLACEHOLDER, areEmpty, hasRegion, isSlotEmpty, markerText, ownName, propsOf, slotsOf } from './tree.js'

// Each of the site's components by its machine name: the directory it sits
// in. Read on first use, so the renderer also runs outside webpack.
let own
const siteComponents = () => {
  if (!own) {
    const context = require.context('~/components/canvas', true, /\/index\.vue$/)
    own = Object.fromEntries(context.keys().map((key) => [key.split('/').slice(-2)[0], context(key).default]))
  }
  return own
}

export default {
  name: 'CanvasComponentTree',

  props: {
    /** The page's `content`: a json-render document, or null. */
    tree: { type: Object, default: null },
    /** Whether to draw the editor's markers and drop areas. */
    preview: { type: Boolean, default: false },
    /** Components by machine name, in place of the site's own. */
    components: { type: Object, default: null },
  },

  render(h) {
    const tree = this.tree && this.tree.root ? this.tree : null
    const editor = this.preview
    const registry = this.components || siteComponents()
    const marker = (type, end, id) => {
      const node = this._e()
      node.text = ` ${markerText(type, end, id)} `
      return node
    }
    const placeholder = (type) =>
      h('div', { class: `canvas--${type}-empty-placeholder`, attrs: { 'aria-hidden': 'true' } })
    const markup = (html, key) =>
      h('span', { key, style: { display: 'contents' }, domProps: { innerHTML: html } })

    const render = (key) => {
      const node = tree.elements[key]
      if (!node || node.type === SLOT_PLACEHOLDER) return []
      const structural = () => slotsOf(node).flatMap(([, keys]) => keys.flatMap(render))

      if (node.type === REGION) {
        if (!editor) return structural()
        const keys = slotsOf(node).flatMap(([, children]) => children)
        return [
          marker('region', false, 'content'),
          ...(areEmpty(tree, keys) ? [placeholder('region')] : []),
          ...structural(),
          marker('region', true, 'content'),
        ]
      }
      if (node.type === MARKER) {
        return editor
          ? [marker('component', false, key), ...structural(), marker('component', true, key)]
          : structural()
      }
      if (node.type === MARKUP) {
        return typeof node.props.markup === 'string' ? [markup(node.props.markup, key)] : []
      }
      const name = ownName(node.type)
      if (!name) return structural()

      const component = registry[name]
      if (!component) {
        console.error(`[canvas] Canvas component "${name}" (instance "${key}") is not registered; omitted subtree at "elements.${key}".`)
        return []
      }
      const scopedSlots = Object.fromEntries(
        slotsOf(node).map(([slot, keys]) => {
          const empty = isSlotEmpty(tree, keys)
          return [
            slot,
            () => {
              const content = (editor && empty ? [] : keys).flatMap(render)
              if (!editor) return content
              const id = `${key}/${slot}`
              return [
                marker('slot', false, id),
                ...(empty ? [placeholder('slot')] : []),
                ...content,
                marker('slot', true, id),
              ]
            },
          ]
        })
      )
      const props = propsOf(node.props)
      const rendered = h(component, { key, props, attrs: props, scopedSlots })
      return editor ? [marker('component', false, key), rendered, marker('component', true, key)] : [rendered]
    }

    const content = tree ? render(tree.root) : []
    const wrapped =
      editor && !hasRegion(tree)
        ? [
            marker('region', false, 'content'),
            ...(tree && !areEmpty(tree, [tree.root]) ? [] : [placeholder('region')]),
            ...content,
            marker('region', true, 'content'),
          ]
        : content
    return h('div', { class: 'canvas-component-tree' }, wrapped)
  },
}
