/**
 * Reading the json-render document Canvas's content API answers with.
 *
 * A document is flat: `root` names an element, and each element names its
 * children and named slots by key. A component's key is its instance UUID,
 * which the editor selects it by. These follow the SDK's framework-neutral
 * helpers in @drupal-canvas/json-render/renderer, which are not imported:
 * they bring the document schema, and zod with it, into the browser's bundle.
 * The server validates each document against that schema before it gets here.
 */

/** The element around a page's routed content, in the site's chrome. */
export const REGION = 'canvas-preview-content-region'

/** A preview-only element standing for a marker component. */
export const MARKER = 'canvas-marker'

/** A preview-only element that keeps an empty slot. */
export const SLOT_PLACEHOLDER = 'canvas-slot-placeholder'

/** Markup Drupal rendered: a component that is not the site's own. */
export const MARKUP = 'drupal-markup'

/** A structural element whose children render in its place. */
export const CONTAINER = 'renderless-container'

/** How a document names one of the site's own components. */
const OWN = 'js.'

const PREFIXES = {
  component: ['canvas-start-', 'canvas-end-'],
  slot: ['canvas-slot-start-', 'canvas-slot-end-'],
  region: ['canvas-region-start-', 'canvas-region-end-'],
}

/**
 * The text of an editor marker comment.
 *
 * @param {string} type - component, slot or region.
 * @param {boolean} end - Whether the marker closes the boundary.
 * @param {string} id - The component UUID, `uuid/slot`, or the region's id.
 * @returns {string} The comment's text.
 */
export const markerText = (type, end, id) => `${PREFIXES[type][end ? 1 : 0]}${id}`

/**
 * An element's slots in render order: the default first, from `children`.
 *
 * @param {object} element - A document element.
 * @returns {Array<[string, string[]]>} Each slot's name and element keys.
 */
export const slotsOf = (element) => {
  const named = Object.keys(element.slots || {}).filter((name) => name !== 'default')
  return [
    ...(element.children.length ? [['default', element.children]] : []),
    ...named.map((name) => [name, element.slots[name] || []]),
  ]
}

const childrenOf = (element) => [
  ...element.children,
  ...Object.values(element.slots || {}).flat(),
]

/**
 * The machine name of one of the site's components, from its type.
 *
 * @param {string} type - An element's type, such as `js.hero`.
 * @returns {string|null} The name, such as `hero`, or null for another type.
 */
export const ownName = (type) =>
  typeof type === 'string' && type.startsWith(OWN) && type.length > OWN.length ? type.slice(OWN.length) : null

/**
 * A component's props as its Vue component declares them, in camel case.
 *
 * The document keeps each input's name as Canvas declares it, such as
 * `note_link_text`. Custom Elements, which Canvas answered through before,
 * camel-cased them, and the site's components declare them that way.
 *
 * @param {object} props - An element's props.
 * @returns {object} The same values, by camel-cased name.
 */
export const propsOf = (props) =>
  Object.fromEntries(
    Object.entries(props || {}).map(([name, value]) => [
      name.replace(/[_-]+([a-z0-9])/g, (match, letter) => letter.toUpperCase()),
      value,
    ])
  )

// Whether a comment in Drupal's markup marks a component.
const marksComponent = (markup) =>
  [...markup.matchAll(/<!--([\s\S]*?)-->/g)].some(([, text]) =>
    PREFIXES.component.some((prefix) => text.trim().startsWith(prefix))
  )

// A slot child that an editor did not place: a placeholder, or markup with no
// component inside, which is the component's example content.
const isDefault = (tree, key) => {
  const element = tree.elements[key]
  if (!element) return false
  if (element.type === SLOT_PLACEHOLDER) return true
  if (element.type !== MARKUP) return false
  if (typeof element.props.markup === 'string' && marksComponent(element.props.markup)) return false
  return childrenOf(element).every((child) => isDefault(tree, child))
}

/**
 * Whether a slot holds nothing an editor placed.
 *
 * @param {object} tree - The document.
 * @param {string[]} keys - The slot's element keys.
 * @returns {boolean} True when the editor shows the slot's drop area.
 */
export const isSlotEmpty = (tree, keys) => keys.every((key) => isDefault(tree, key))

const isElementEmpty = (tree, key) => {
  const element = tree.elements[key]
  if (!element) return true
  if (element.type === CONTAINER || element.type === REGION) {
    return childrenOf(element).every((child) => isElementEmpty(tree, child))
  }
  if (element.type === MARKUP) return typeof element.props.markup !== 'string' || !element.props.markup.trim()
  return element.type === SLOT_PLACEHOLDER
}

/**
 * Whether elements render no page content.
 *
 * @param {object} tree - The document.
 * @param {string[]} keys - Element keys.
 * @returns {boolean} True when none of them has content.
 */
export const areEmpty = (tree, keys) => keys.every((key) => isElementEmpty(tree, key))

// Every element reachable from the root, each once.
const reachable = (tree) => {
  const seen = new Set()
  const visit = (key) => {
    if (seen.has(key) || !tree.elements[key]) return
    seen.add(key)
    childrenOf(tree.elements[key]).forEach(visit)
  }
  if (tree.root) visit(tree.root)
  return [...seen].map((key) => tree.elements[key])
}

const isDocument = (tree) =>
  Boolean(tree) && typeof tree === 'object' && typeof tree.root === 'string' && Boolean(tree.elements)

/**
 * Whether a document has its own content region, which the editor drops into.
 *
 * @param {object|null} tree - The document.
 * @returns {boolean} True when an element of it is the region.
 */
export const hasRegion = (tree) => isDocument(tree) && reachable(tree).some(({ type }) => type === REGION)

/**
 * Whether a document holds any of the site's own components.
 *
 * @param {object|null} tree - The document.
 * @returns {boolean} True when an element of it is the site's own.
 */
export const hasOwn = (tree) => isDocument(tree) && reachable(tree).some(({ type }) => ownName(type) !== null)
