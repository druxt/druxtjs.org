import Vue from 'vue'
import EntityOperations from '~/components/app/EntityOperations.vue'
import { hasEditorHint, operationsUrl, operationsOf } from '~/lib/entity-operations'

/**
 * `v-druxt-admin="entity"`: Drupal's operations for an entity, for an editor.
 *
 * Registered everywhere so the server renders the directive as nothing, but
 * it only acts in the browser, and only when Drupal has left its signed-in
 * hint. A reader's browser makes no request and gets no markup. The entities
 * on a page are asked for together, one request per resource type.
 */
const Menu = Vue.extend(EntityOperations)
const pending = new Map()
let scheduled = false

const flush = async () => {
  scheduled = false
  const batches = [...pending.entries()]
  pending.clear()
  await Promise.all(
    batches.map(async ([type, byId]) => {
      try {
        const response = await fetch(operationsUrl(type, [...byId.keys()]), {
          credentials: 'same-origin',
          headers: { Accept: 'application/vnd.api+json' },
        })
        if (!response.ok) return
        const { data = [] } = await response.json()
        for (const resource of data) {
          const operations = operationsOf(resource)
          if (!operations.length) continue
          for (const target of byId.get(resource.id) || []) mount(target, operations)
        }
      } catch (error) {
        // An editor's convenience, never a reason for the page to break.
      }
    }),
  )
}

const mount = ({ el, label, state, resource, parent }, operations) => {
  if (!el.isConnected || el.__druxtOperations) return
  const holder = document.createElement('div')
  // Last, so Vue's own children keep their places around it.
  el.appendChild(holder)
  el.classList.add('relative')
  // A child of the page's component, so it reaches the store and the router.
  el.__druxtOperations = new Menu({ parent, propsData: { operations, label, state, resource } }).$mount(holder)
}

Vue.directive('druxt-admin', {
  inserted(el, { value }, vnode) {
    if (!value || !value.type || !value.id || !hasEditorHint(document.cookie)) return
    const byId = pending.get(value.type) || new Map()
    const target = {
      el,
      label: (value.attributes || {}).title || 'this page',
      state: value.state || null,
      resource: { type: value.type, id: value.id },
      parent: vnode.context,
    }
    byId.set(value.id, [...(byId.get(value.id) || []), target])
    pending.set(value.type, byId)
    if (!scheduled) {
      scheduled = true
      setTimeout(flush, 0)
    }
  },
  unbind(el) {
    if (!el.__druxtOperations) return
    el.__druxtOperations.$destroy()
    el.__druxtOperations.$el.remove()
    delete el.__druxtOperations
  },
})
