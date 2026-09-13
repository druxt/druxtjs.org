<template>
  <div>
    <h3 v-if="title" class="text-[17px] font-semibold tracking-tight mb-3">{{ title }}</h3>
    <!-- The fields, as Druxt renders them: each through DruxtField and this site's field wrappers. -->
    <div class="druxt-entity-fields" :class="{ 'druxt-entity-form': form }">
      <slot />
    </div>
  </div>
</template>

<script>
/**
 * The default entity wrapper: the label, then the fields as Druxt renders
 * them. Catches any entity, view or form, with no wrapper of its own.
 */
export default {
  // DruxtEntity's other props are not HTML attributes.
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: () => ({}) },
    fields: { type: [Object, Boolean], default: () => ({}) },
    schema: { type: Object, default: () => ({}) },
    value: { type: Object, default: undefined },
  },
  computed: {
    title: ({ entity }) => {
      const a = entity.attributes || {}
      return a.title || a.name || a.label || a.info || ''
    },
    form: ({ schema }) => ((schema || {}).config || {}).schemaType === 'form',
  },
}
</script>
