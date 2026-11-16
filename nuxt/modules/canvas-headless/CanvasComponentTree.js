/**
 * Renders the component tree Canvas's content API answers with.
 *
 * In a draft session each component, slot and region sits between two
 * comment markers, which the editor selects and drags by. Vue 2 has no
 * fragments, so the whole tree renders in one render function, where a list
 * of children may hold comment nodes beside the components.
 */
const MARKERS = {
  component: ['canvas-start-', 'canvas-end-'],
  slot: ['canvas-slot-start-', 'canvas-slot-end-'],
  region: ['canvas-region-start-', 'canvas-region-end-'],
}
const REGION_ELEMENT = 'canvas-preview-content-region'

// Each component by its machine name: the directory it sits in.
const context = require.context('~/components/canvas', true, /\/index\.vue$/)
const registry = Object.fromEntries(
  context.keys().map((key) => [key.split('/').slice(-2)[0], context(key).default])
)

const children = (slot) =>
  slot === undefined ? [] : Array.isArray(slot) ? slot.flatMap(children) : [slot]

// A slot with nothing an editor placed: only markup Drupal rendered.
const isDefault = (child) =>
  typeof child === 'string' ||
  (child.element === 'drupal-markup' &&
    Object.values(child.slots || {}).every((slot) => children(slot).every(isDefault)))

const hasRegion = (node) =>
  !!node &&
  (node.element === REGION_ELEMENT ||
    Object.values(node.slots || {}).some((slot) =>
      children(slot).some((child) => typeof child !== 'string' && hasRegion(child))
    ))

export default {
  name: 'CanvasComponentTree',

  props: {
    tree: { type: Object, default: null },
  },

  render(h) {
    const editor = !!this.tree && this.tree.canvasDraftMode === true
    const marker = (type, end, id) => {
      const node = this._e()
      node.text = ` ${MARKERS[type][end ? 1 : 0]}${id} `
      return node
    }
    const placeholder = (type) =>
      h('div', { class: `canvas--${type}-empty-placeholder`, attrs: { 'aria-hidden': 'true' } })
    const markup = (html, key) =>
      h('span', { key, style: { display: 'contents' }, domProps: { innerHTML: html } })

    const render = (node, path) => {
      const slots = Object.entries(node.slots || {}).map(([name, value]) => ({
        name,
        items: children(value),
        empty: children(value).every(isDefault),
      }))
      const each = (items, name) =>
        items.flatMap((child, index) =>
          typeof child === 'string'
            ? [markup(child, `${path}:${name}:${index}`)]
            : render(child, `${path}:${name}:${index}`)
        )
      const structural = () => slots.flatMap(({ name, items }) => each(items, name))

      if (node.element === REGION_ELEMENT) {
        return editor
          ? [marker('region', false, 'content'), ...structural(), marker('region', true, 'content')]
          : structural()
      }
      const name = node.element.startsWith('js-') ? node.element.slice(3) : null
      if (!name) return structural()

      const component = registry[name]
      if (!component) {
        console.error(`[canvas] Canvas component "${name}" is not registered; omitted at "${path}".`)
        return []
      }
      const { canvasUuid: uuid, ...props } = node.props || {}
      const scopedSlots = Object.fromEntries(
        slots.map(({ name: slot, items, empty }) => [
          slot,
          () => {
            const content = each(editor && empty ? [] : items, slot)
            if (!editor || !uuid) return content
            const id = `${uuid}/${slot}`
            return [
              marker('slot', false, id),
              ...(empty ? [placeholder('slot')] : []),
              ...content,
              marker('slot', true, id),
            ]
          },
        ])
      )
      const rendered = h(component, { key: uuid || path, props, attrs: props, scopedSlots })
      return editor && uuid
        ? [marker('component', false, uuid), rendered, marker('component', true, uuid)]
        : [rendered]
    }

    const content = this.tree ? render(this.tree, 'tree') : []
    const wrapped =
      editor && !hasRegion(this.tree)
        ? [marker('region', false, 'content'), ...(content.length ? [] : [placeholder('region')]), ...content, marker('region', true, 'content')]
        : content
    return h('div', { class: 'canvas-component-tree' }, wrapped)
  },
}
