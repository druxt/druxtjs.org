<template>
  <div :data-druxt-entity="(entity || {}).id || false" :data-druxt-type="(entity || {}).type" data-druxt-field="field_rich_text" v-diff="fieldDiff('field_rich_text')">
    <slot name="field_rich_text" />
  </div>
</template>

<script>
/** A rich text block. */
import diffable from '~/mixins/diffable-field'

export default {
  mixins: [diffable],
  // DruxtEntity's other props (fields, schema, value) are not HTML attributes.
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
