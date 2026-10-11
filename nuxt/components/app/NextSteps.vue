<template>
  <footer class="mt-12 pt-6 border-t border-base-300 flex flex-col gap-3">
    <AppPageCard v-if="first" eyebrow="Next" :title="first.text" :description="first.description" :to="first.to" large arrow />
    <template v-if="also.length">
      <h2 class="text-xs uppercase tracking-wider text-base-content/70 mt-2">Also</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <AppPageCard v-for="item in also" :key="item.to" :title="item.text" :description="item.description" :to="item.to" />
      </div>
    </template>
    <NuxtLink v-if="prev" :to="prev.to" class="mt-1 text-sm text-base-content/70 hover:text-primary-focus">&larr; Previous: {{ prev.text }}</NuxtLink>
  </footer>
</template>

<script>
/**
 * The end of a page: where to go next, and the way back.
 *
 * The editor's first link from the page's "Where to go next" field is the
 * page's Next, drawn large; the rest follow under "Also". With the field
 * empty, the next page in the docs menu is the Next, so no page ends without
 * a way on. Previous is the menu's, as text.
 */
export default {
  props: {
    /** `{ text, to, description }` each, in the editor's order. */
    next: { type: Array, default: () => [] },
    /** The docs menu's next sibling, `{ text, to }`, the fallback. */
    sibling: { type: Object, default: null },
    /** The docs menu's previous sibling, `{ text, to }`. */
    prev: { type: Object, default: null },
  },
  computed: {
    first() {
      if (this.next.length) return this.next[0]
      return this.sibling ? { text: this.sibling.text, to: this.sibling.to, description: '' } : null
    },
    also: ({ next }) => next.slice(1),
  },
}
</script>
