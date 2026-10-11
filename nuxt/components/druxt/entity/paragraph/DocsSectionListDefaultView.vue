<template>
  <div :data-druxt-entity="(entity || {}).id || false" :data-druxt-type="(entity || {}).type" data-druxt-field="field_section">
    <DruxtView v-if="section" view-id="docs_section" :display-id="style" :arguments="[String(section)]" />
  </div>
</template>

<script>
/**
 * A "Pages in this section" block: the docs_section view, where the editor
 * put it in the page, in the display the editor chose.
 */
export default {
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
  },
  computed: {
    section: ({ entity }) => ((((((entity || {}).relationships || {}).field_section || {}).data) || {}).meta || {}).drupal_internal__target_id || null,
    style: ({ entity }) => ((entity || {}).attributes || {}).field_section_list_style || 'default',
  },
}
</script>
