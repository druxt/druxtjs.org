<template>
  <div>
    <ul class="divide-y divide-base-300">
      <li v-for="row in rows" :key="row.id" class="py-3">
        <p class="text-sm font-medium">{{ row.label }}</p>
        <p v-if="row.line" class="text-[12.5px] text-base-content/70 truncate">{{ row.line }}</p>
      </li>
      <li v-if="!rows.length" class="py-3 text-sm text-base-content/70">No results.</li>
    </ul>
    <p v-if="pages > 1" class="mt-3 text-sm space-x-4">
      <span class="text-base-content/70">Page {{ page + 1 }} of {{ pages }}</span>
    </p>
  </div>
</template>

<script>
/**
 * The default view wrapper: one row per result on hairlines, the entity's
 * label and one line of its other fields, and the page position.
 */
const skip = new Set(['drupal_internal__nid', 'drupal_internal__vid', 'langcode', 'status', 'created', 'changed', 'default_langcode', 'revision_timestamp', 'revision_log', 'revision_translation_affected', 'promote', 'sticky', 'path', 'metatag'])

export default {
  props: {
    results: { type: Array, default: () => [] },
    view: { type: Object, default: () => ({}) },
    display: { type: Object, default: () => ({}) },
    pager: { type: Object, default: () => ({}) },
    count: { type: Number, default: 0 },
  },
  computed: {
    rows: ({ results }) =>
      results.map((o) => {
        const a = o.attributes || {}
        const line = Object.entries(a)
          .filter(([key, value]) => !skip.has(key) && !['title', 'name', 'label'].includes(key) && typeof value !== 'object' && value !== '' && value != null)
          .slice(0, 3)
          .map(([, value]) => String(value))
          .join(' · ')
        return { id: o.id, label: a.title || a.name || a.label || o.id, line }
      }),
    page: ({ pager }) => Number((pager || {}).current || 0),
    pages: ({ pager, count }) => {
      const per = Number(((pager || {}).options || {}).items_per_page || 0)
      return per ? Math.ceil(count / per) : 1
    },
  },
}
</script>
