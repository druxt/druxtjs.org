<template>
  <!-- Layout paragraphs are laid out in Drupal's own editor; here, what the field holds. -->
  <div>
    <strong v-if="label">{{ label }}:</strong>
    <p v-if="items.length" class="text-[13px] text-base-content/70">{{ items.length }} paragraphs: {{ summary }}</p>
    <p v-else class="text-[13px] text-base-content/70">No paragraphs.</p>
  </div>
</template>

<script>
export default {
  props: {
    schema: { type: Object, default: () => ({}) },
    value: { type: [Array, Object], default: null },
  },
  computed: {
    label: ({ schema }) => ((schema || {}).label || {}).text || '',
    items: ({ value }) => [].concat(((value || {}).data) || value || []).filter((o) => o && o.type),
    // Counted by paragraph type: "3 docs_text, 2 docs_code, 1 docs_layout_section".
    summary: ({ items }) => {
      const counts = {}
      for (const o of items) counts[o.type.replace('paragraph--', '')] = (counts[o.type.replace('paragraph--', '')] || 0) + 1
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([type, n]) => `${n} ${type}`).join(', ')
    },
  },
}
</script>
