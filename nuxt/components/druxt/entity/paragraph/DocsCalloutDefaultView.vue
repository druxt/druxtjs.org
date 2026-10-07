<template>
  <div :data-callout="entity && entity.attributes.field_callout_type" :data-druxt-entity="(entity || {}).id || false" :data-druxt-type="(entity || {}).type" data-druxt-field="field_callout" v-diff="fieldDiff('field_callout')">
    <slot name="field_callout" />
  </div>
</template>

<script>
/** A callout. Its type ("Before you start", "Program output") is data, not a printed label. */
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
