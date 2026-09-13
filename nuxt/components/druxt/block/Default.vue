<template>
  <div>
    <p v-if="label" class="text-sm font-semibold mb-1">{{ label }}</p>
    <p class="text-sm text-base-content/70">{{ plugin }}</p>
    <!-- What the block is configured with, beyond how it is labelled. -->
    <dl v-if="rows.length" class="mt-2 grid gap-x-3 gap-y-0.5 text-[12.5px]" style="grid-template-columns: max-content minmax(0, 1fr)">
      <template v-for="row in rows">
        <dt :key="row.key + ':k'" class="font-mono text-base-content/70">{{ row.key }}</dt>
        <dd :key="row.key + ':v'" class="min-w-0 break-words">{{ row.value }}</dd>
      </template>
    </dl>
  </div>
</template>

<script>
// Labelling and bookkeeping, shown above or not worth a row.
const skip = new Set(['id', 'label', 'label_display', 'provider', 'status', 'info', 'view_mode', 'context_mapping'])

/**
 * The default block wrapper: the block's label where it shows one, the
 * plugin it renders, and its settings. A block is whatever its plugin
 * contains, so a default can name and describe it and no more.
 */
export default {
  props: {
    block: { type: Object, required: true },
  },
  computed: {
    settings: ({ block }) => (block.attributes || {}).settings || {},
    label: ({ settings }) => (settings.label_display ? settings.label : ''),
    plugin: ({ block }) => (block.attributes || {}).plugin || '',
    rows: ({ settings }) =>
      Object.entries(settings)
        .filter(([key, value]) => !skip.has(key) && value !== '' && value !== null && typeof value !== 'object')
        .map(([key, value]) => ({ key, value: String(value) })),
  },
}
</script>
