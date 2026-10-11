<template>
  <article>
    <AppPageHeader :title="title" :description="description" />
    <AppProse :key="uuid" :title="title">
      <slot />
    </AppProse>
  </article>
</template>

<script>
/**
 * A page's preview, in the shell a saved page gets.
 *
 * The preview module renders the unsaved node through DruxtEntity in this
 * wrapper's slot. Around it goes what components/app/SectionDocument.vue
 * gives a saved page: the page header with the title and description, and
 * the prose container, so an editor previews what readers will see.
 */
export default {
  props: {
    /** The previewed node, its unsaved attributes included. */
    entity: { type: Object, required: true },
    uuid: { type: String, default: null },
  },
  computed: {
    title() {
      return (this.entity.attributes || {}).title || 'Preview'
    },
    description() {
      return (this.entity.attributes || {}).field_description || null
    },
  },
}
</script>
