<template>
  <!-- Edit, and the rest behind the dots. Shown while the page header is hovered or focused. -->
  <div class="page-ops flex items-center h-[30px] border border-base-300 rounded-lg bg-base-100 shadow-sm text-[12.5px] font-medium" data-druxt-operations>
    <a v-if="edit" :href="edit.href" target="_self" class="page-ops-seg px-2.5 rounded-l-lg" :aria-label="`Edit ${label}`">
      <svg class="account-icon !w-[15px] !h-[15px]" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      Edit
    </a>

    <div class="dropdown dropdown-end h-full">
      <button
        type="button"
        tabindex="0"
        class="page-ops-seg px-[7px] h-full rounded-r-lg"
        :class="{ 'border-l border-base-300': edit, 'rounded-l-lg': !edit }"
        :aria-label="`More actions for ${label}`"
      >
        <svg class="account-icon !w-[15px] !h-[15px]" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
      </button>

      <div tabindex="0" class="dropdown-content mt-2 w-[236px] p-1.5 bg-base-100 border border-base-300 rounded-xl shadow-lg z-20">
        <div class="px-2.5 pt-2 pb-2.5">
          <div class="text-[13px] font-semibold">This page</div>
          <div class="flex items-center gap-1.5 mt-0.5 text-xs text-base-content/70">
            <span class="w-[7px] h-[7px] rounded-full flex-shrink-0" :class="draft ? 'bg-warning' : 'bg-success'" />
            {{ draft ? 'Draft pending' : 'Published' }}
          </div>
        </div>
        <div class="h-px bg-base-300 -mx-1.5 my-1.5" />

        <a v-if="edit" :href="edit.href" target="_self" class="account-item">
          <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          {{ draft ? 'Edit draft' : 'Edit' }}
          <kbd class="kbd kbd-xs ml-auto">E</kbd>
        </a>
        <a v-if="revisions" :href="revisions.href" target="_self" class="account-item" @click="toRevisions">
          <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></svg>
          Revisions
          <span v-if="revisionCount" class="ml-auto text-[11.5px] text-base-content/50 tabular-nums">{{ revisionCount }}</span>
        </a>
        <a v-for="operation of others" :key="operation.key" :href="operation.href" target="_self" class="account-item">
          <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>
          {{ operation.title }}
        </a>

        <template v-if="remove">
          <div class="h-px bg-base-300 -mx-1.5 my-1.5" />
          <button type="button" class="account-item danger w-full" @click="confirming = true">
            <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /></svg>
            Delete…
          </button>
        </template>
      </div>
    </div>

    <!-- Delete, confirmed here rather than on Drupal's form. -->
    <div
      v-if="confirming"
      ref="confirm"
      class="fixed inset-0 z-[70] flex items-center justify-center bg-neutral/50 px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      @click.self="cancel"
      @keydown.esc.prevent="cancel"
    >
      <div class="w-full max-w-[400px] bg-base-100 border border-base-300 rounded-2xl shadow-2xl p-5 font-normal text-sm">
        <h2 id="delete-title" class="text-base font-bold tracking-tight mb-2">Delete “{{ label }}”?</h2>
        <p class="text-[13px] text-base-content/70 leading-relaxed mb-5">
          The page<template v-if="revisionCount"> and its {{ revisionCount }} revisions</template> are removed from Drupal.
          Links to <code class="text-xs">{{ path }}</code> will return 404. This can't be undone.
        </p>
        <p v-if="error" class="sign-in-error mb-4" role="alert">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <button ref="cancel" type="button" class="h-9 px-3.5 rounded-lg border border-base-300 font-medium" :disabled="deleting" @click="cancel">Cancel</button>
          <button type="button" class="page-ops-delete h-9 px-3.5 rounded-lg font-semibold" :disabled="deleting" @click="destroy">
            {{ deleting ? 'Deleting…' : 'Delete page' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
/**
 * The operations Drupal offers the signed-in user on one entity.
 *
 * Mounted by the `v-druxt-admin` directive in the browser only, so a reader's
 * page carries none of it. Edit and the other screens are Drupal's, served on
 * this origin by the proxy; Revisions opens the editor toolbar's switcher when
 * the page has one; Delete is confirmed here and sent over JSON:API.
 */
export default {
  props: {
    operations: { type: Array, required: true },
    label: { type: String, default: 'this page' },
    /** The JSON:API resource: `{ type, id }`. */
    resource: { type: Object, default: null },
    /** The page's moderation state, when it has one. */
    state: { type: String, default: null },
  },

  data: () => ({ confirming: false, deleting: false, error: null }),

  computed: {
    byKey: ({ operations }) => Object.fromEntries(operations.map((o) => [o.key, o])),
    edit: ({ byKey }) => byKey['edit-form'] || null,
    revisions: ({ byKey }) => byKey['version-history'] || null,
    remove: ({ byKey, resource }) => (resource && byKey['delete-form']) || null,
    others: ({ operations }) => operations.filter((o) => !['edit-form', 'version-history', 'delete-form'].includes(o.key)),
    draft: ({ state }) => Boolean(state && state !== 'published'),
    revisionCount: ({ $store }) => (($store && $store.state.editor && $store.state.editor.revisions) || []).length,
    path: () => (typeof window === 'undefined' ? '' : window.location.pathname),
  },

  watch: {
    confirming(open) {
      if (open) this.$nextTick(() => this.$refs.cancel && this.$refs.cancel.focus())
    },
  },

  mounted() {
    document.addEventListener('keydown', this.onKey)
  },

  beforeDestroy() {
    document.removeEventListener('keydown', this.onKey)
  },

  methods: {
    /**
     * E opens the edit form, unless the reader is typing, something has
     * already acted on the key, or the delete dialog is open. The dialog puts
     * focus on its Cancel button, which is not a text field, so without this
     * an E while it is open navigates away and the dialog vanishes unanswered.
     */
    onKey(event) {
      if (this.confirming || event.defaultPrevented) return
      if (!this.edit || event.key !== 'e' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const target = event.target || {}
      if (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName || '')) return
      window.location.href = this.edit.href
    },

    /** The toolbar's revision switcher, when this page has the toolbar. */
    toRevisions(event) {
      const select = document.getElementById('editor-version')
      if (!select) return
      event.preventDefault()
      if (document.activeElement) document.activeElement.blur()
      select.focus()
      if (select.showPicker) {
        try {
          select.showPicker()
        } catch (e) {
          // Focus alone is enough where the picker cannot open programmatically.
        }
      }
    },

    cancel() {
      if (this.deleting) return
      this.confirming = false
      this.error = null
    },

    async destroy() {
      this.deleting = true
      this.error = null
      try {
        const token = await (await fetch('/session/token', { credentials: 'same-origin' })).text()
        const { type, id } = this.resource
        const response = await fetch(`/jsonapi/${type.replace('--', '/')}/${id}`, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { Accept: 'application/vnd.api+json', 'X-CSRF-Token': token },
        })
        if (!response.ok) throw new Error(String(response.status))
        // A full load, so nothing of the deleted page stays in the store.
        window.location.href = window.location.pathname.replace(/\/[^/]+\/?$/, '') || '/'
      } catch (error) {
        this.error = "Drupal didn't delete the page. Try again, or delete it from Drupal."
        this.deleting = false
      }
    },
  },
}
</script>
