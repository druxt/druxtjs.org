<template>
  <article v-if="mode === 'full'">
    <AppPageHeader :title="title" :description="description" />
    <AppProse :key="uuid" :title="title">
      <slot />
    </AppProse>
  </article>
  <div v-else class="mx-auto max-w-2xl px-4 py-8" :data-view-mode="mode">
    <slot />
  </div>
</template>

<script>
/**
 * A page's preview, in the shell the view mode gets on the site.
 *
 * The preview module renders the unsaved node through DruxtEntity in this
 * wrapper's slot. In the full view mode it gets what
 * components/app/SectionDocument.vue gives a saved page: the page header and
 * the prose container. Other view modes, a teaser card or a tutorial step,
 * appear inside another page's list rather than as a page, so they render
 * alone, without a page title above them.
 */
export default {
  props: {
    /** The previewed node, its unsaved attributes included. */
    entity: { type: Object, required: true },
    /** The view mode being previewed. */
    mode: { type: String, default: 'full' },
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
