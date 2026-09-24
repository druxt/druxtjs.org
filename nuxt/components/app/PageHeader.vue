<template>
  <header class="mb-8 pb-6 border-b border-base-300">
    <div v-if="badges.length" class="flex flex-wrap gap-2 mb-3">
      <span
        v-for="badge of badges"
        :key="badge.text"
        class="badge badge-sm"
        :class="badge.class || 'badge-primary badge-outline'"
        v-text="badge.text"
      />
    </div>

    <!-- `group`: hovering the title row reveals an editor's page operations. -->
    <div class="group flex items-start gap-4">
      <h1 class="flex-1 min-w-0 text-3xl sm:text-4xl font-bold tracking-tight" v-text="title" />
      <div v-if="entity" v-druxt-admin="entity" class="page-ops-slot flex-none mt-1.5" />
    </div>

    <p v-if="description" class="mt-3 text-lg text-base-content/70" v-text="description" />

    <slot />
  </header>
</template>

<script>
export default {
  props: {
    title: { type: String, required: true },
    description: { type: String, default: null },
    /** [{ text, class }] */
    badges: { type: Array, default: () => [] },
    /** The Drupal entity the page is, `{ type, id, attributes: { title }, state }`, for its operations. */
    entity: { type: Object, default: null },
  },
}
</script>
