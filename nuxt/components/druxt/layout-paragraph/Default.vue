<template>
  <DuiColumns :row="row">
    <slot v-for="region in regions" :name="region" />
  </DuiColumns>
</template>

<script>
/**
 * A layout section's regions, in reading order. A section of diagrams in
 * columns renders as a row.
 */
export default {
  props: {
    children: { type: Array, default: () => [] },
    entity: { type: Object, default: undefined },
  },
  computed: {
    regions: ({ children }) =>
      children
        .map((o) => o.attributes.behavior_settings.layout_paragraphs.region)
        .filter((region, index, all) => all.indexOf(region) === index),
    row: ({ children, regions }) => regions.length > 1 && children.every((o) => o.type === 'paragraph--docs_diagram'),
  },
}
</script>
