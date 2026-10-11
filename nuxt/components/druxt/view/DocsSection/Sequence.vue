<template>
  <!-- The prose styles reach in here, so the list carries its own rules (assets/css/app.css). -->
  <div v-if="pages.length" class="mt-6">
    <ol class="page-sequence flex flex-col gap-3 list-none m-0 p-0" aria-label="Pages in this section, in order">
      <li v-for="page in pages" :key="page.id">
        <DruxtEntity :type="page.type" :uuid="page.id" mode="step" />
      </li>
    </ol>
  </div>
</template>

<script>
/**
 * The docs_section view's sequence display: the section's pages as steps.
 *
 * Each page renders in its step view mode, and the list counts them, so the
 * numbers follow the view's order. The landing itself is left out.
 */
export default {
  props: {
    results: { type: Array, default: () => [] },
    view: { type: Object, default: () => ({}) },
    display: { type: Object, default: () => ({}) },
    pager: { type: Object, default: () => ({}) },
    count: { type: Number, default: 0 },
  },
  computed: {
    pages() {
      const current = this.$route.path.replace(/\/$/, '')
      return this.results.filter((page) => (((page.attributes || {}).path || {}).alias || '') !== current)
    },
  },
}
</script>
