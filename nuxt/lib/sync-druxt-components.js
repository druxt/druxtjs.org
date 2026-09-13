/**
 * Marks the Druxt packages' components for synchronous registration.
 *
 * Nuxt registers auto-imported components as async chunks in production.
 * Druxt renders some of its own with a `key` (a region's blocks, an
 * entity's fields), and Vue 2 gives an unresolved async component a
 * placeholder without one, so once the chunk arrives the keyed node is not
 * "the same" and the hydrated markup is thrown away and rendered again:
 * every page refetched the docs menu that way. Loaded up front, they hydrate.
 *
 * @param {Array<{ filePath: string, isAsync: boolean|null }>} components - What @nuxt/components found.
 */
const syncDruxtComponents = (components) => {
  for (const component of components) {
    if (/[\\/]node_modules[\\/]druxt(-[a-z-]+)?[\\/]/.test(component.filePath)) component.isAsync = false
  }
}

module.exports = { syncDruxtComponents }
