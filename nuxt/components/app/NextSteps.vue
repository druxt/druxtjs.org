<template>
  <nav v-if="items.length" class="mt-12" aria-labelledby="next-steps-heading">
    <h2 id="next-steps-heading" class="text-lg font-semibold">Where to go next</h2>
    <ul class="mt-3 grid gap-3 sm:grid-cols-2">
      <li v-for="item in items" :key="item.to">
        <component
          :is="external(item.to) ? 'a' : 'NuxtLink'"
          v-bind="external(item.to) ? { href: item.to, target: '_blank', rel: 'noopener' } : { to: item.to }"
          class="group block h-full rounded-box border border-base-300 p-4 hover:border-primary transition-colors"
        >
          <span class="block font-medium group-hover:text-primary-focus" v-text="item.text" />
          <span v-if="item.description" class="block mt-1 text-sm text-base-content/70" v-text="item.description" />
        </component>
      </li>
    </ul>
  </nav>
</template>

<script>
/**
 * The pages to read after this one.
 *
 * The editor's list from the page's "Where to go next" field, resolved to
 * each page as it is now, or when the field is empty the next page in the
 * docs menu, so no page ends without a way on.
 */
export default {
  props: {
    /** `{ text, to, description }` each, in the editor's order. */
    next: { type: Array, default: () => [] },
    /** The docs menu's next sibling, `{ text, to }`, the fallback. */
    sibling: { type: Object, default: null },
  },
  computed: {
    items() {
      if (this.next.length) return this.next
      return this.sibling ? [{ text: this.sibling.text, to: this.sibling.to, description: '' }] : []
    },
  },
  methods: {
    /** Whether a link leaves the site: an absolute URL, which the router cannot take. */
    external(to) {
      return /^[a-z][a-z0-9+.-]*:/i.test(to)
    },
  },
}
</script>
