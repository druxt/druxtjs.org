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
    <div class="group flex items-start gap-3">
      <h1 v-diff="rootDiff('title')" class="flex-1 min-w-0 text-3xl sm:text-4xl font-bold tracking-tight" v-text="title" />
      <span v-if="draft" class="page-draft" data-diff-ignore>Draft</span>
      <div v-if="entity" v-druxt-admin="entity" class="page-ops-slot flex-none mt-1.5" />
    </div>

    <p v-if="description" v-diff="rootDiff('field_description')" class="mt-3 text-lg text-base-content/70" v-text="description" />

    <slot />
  </header>
</template>

<script>
import { hasDraft } from '~/lib/revisions'

export default {
  props: {
    title: { type: String, required: true },
    description: { type: String, default: null },
    /** [{ text, class }] */
    badges: { type: Array, default: () => [] },
    /** The Drupal entity the page is, `{ type, id, attributes: { title }, state }`, for its operations. */
    entity: { type: Object, default: null },
  },

  computed: {
    editor: ({ $store }) => ($store && $store.state.editor) || {},
    signedIn: ({ $auth }) => Boolean($auth && $auth.loggedIn),
    /** A pending draft of this page, for a signed-in editor. */
    draft: ({ entity, signedIn, editor }) => Boolean(entity && signedIn && hasDraft(editor.revisions)),
  },

  methods: {
    /** A page-level field's diff against live, while comparing; null otherwise. */
    rootDiff(name) {
      const { compare, diff } = this.editor
      if (!this.entity || !compare || !diff || !diff.rootFields) return null
      return diff.rootFields.find((field) => field.name === name && field.status === 'changed') || null
    },
  },
}
</script>
