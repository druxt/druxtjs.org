<template>
  <!-- Edit, and the rest behind the dots. In the bar, or beside a page's title. -->
  <div
    class="page-ops flex items-center font-medium"
    :class="
      bar
        ? 'editor-bar-ops h-[28px] text-[12.5px]'
        : 'h-[30px] border border-base-300 rounded-lg bg-base-100 shadow-sm text-[12.5px]'
    "
    data-druxt-operations
  >
    <a
      v-if="edit"
      :href="editTarget"
      target="_self"
      class="page-ops-seg px-2.5 rounded-l-lg"
      :aria-label="editAria"
      :title="bar ? editAria : null"
    >
      <svg class="account-icon !w-[15px] !h-[15px]" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
      Edit
    </a>

    <div class="dropdown dropdown-end h-full" :class="{ 'dropdown-top': bar }">
      <button
        type="button"
        tabindex="0"
        class="page-ops-seg px-[7px] h-full rounded-r-lg"
        :class="{ 'border-l border-base-300': edit, 'rounded-l-lg': !edit }"
        :aria-label="`More actions for ${label}`"
      >
        <svg class="account-icon !w-[15px] !h-[15px]" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="19" cy="12" r="1" />
        </svg>
      </button>

      <div
        ref="menu"
        tabindex="0"
        class="ops-menu dropdown-content w-[236px] p-1.5 bg-base-100 border border-base-300 rounded-xl shadow-lg z-20"
        :class="[bar ? 'mb-2' : 'mt-2', { drilled: flyout }]"
        role="menu"
        @keydown="onKey"
      >
        <div class="px-2.5 pt-2 pb-2.5">
          <div class="text-[13px] font-semibold">This page</div>
          <div class="flex items-center gap-1.5 mt-0.5 text-xs text-base-content/70">
            <span
              class="w-[7px] h-[7px] rounded-full flex-shrink-0"
              :class="draft ? 'bg-warning' : 'bg-success'"
            />
            {{ draft ? 'Draft pending' : 'Published' }}
          </div>
        </div>
        <div class="h-px bg-base-300 -mx-1.5 my-1.5" />

        <a
          v-if="edit"
          :href="back(edit.href)"
          target="_self"
          class="account-item"
          data-menu-item
          role="menuitem"
        >
          <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
          {{ draft ? 'Edit draft' : 'Edit' }}
          <kbd class="kbd kbd-xs ml-auto">E</kbd>
        </a>
        <!-- Revisions: a flyout of the latest few, opening to the left, where there is room. -->
        <div v-if="revisions || recent.length" class="revisions-parent relative">
          <button
            ref="revisionsRow"
            type="button"
            class="account-item w-full"
            data-menu-item
            role="menuitem"
            aria-haspopup="true"
            :aria-expanded="String(flyout)"
            @click="toggleFlyout"
          >
            <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
              <path d="M3 3v5h5" />
              <path d="M12 7v5l3 2" />
            </svg>
            {{ flyout ? 'Back' : 'Revisions' }}
            <span
              class="ml-auto flex items-center gap-1 text-[11.5px] text-base-content/50 tabular-nums"
            >
              <template v-if="revisionCount">{{ revisionCount }}</template>
              <svg class="account-icon !w-3.5 !h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                <path :d="flyout ? 'M9 6l6 6-6 6' : 'M15 18l-6-6 6-6'" />
              </svg>
            </span>
          </button>
          <div class="revisions-flyout" :class="{ open: flyout }">
            <div class="revisions-card" role="menu" aria-label="Recent revisions">
              <p v-if="!recent.length" class="px-2.5 py-3 text-xs text-base-content/70">
                Reading the revisions…
              </p>
              <div
                v-for="row of recent"
                :key="row.revision.vid"
                class="revision-row"
                data-testid="revision-row"
                data-flyout-item
                role="menuitem"
                tabindex="-1"
                :aria-label="`${row.when}, ${
                  row.viewing ? 'the revision you are reading' : row.kind
                }, by ${row.author.name}`"
                @keydown.enter.prevent="show(row.revision, false)"
                @keydown.space.prevent="show(row.revision, false)"
              >
                <AppAvatar :account="row.author" :size="24" class="row-span-2" />
                <span class="text-[13px] font-medium truncate">{{ row.when }}</span>
                <span class="revision-row-end row-span-2">
                  <span class="revision-tag" :class="row.viewing ? 'viewing' : row.kind">{{
                    row.viewing ? 'Viewing' : row.kind
                  }}</span>
                  <span v-if="row.actions.length" class="revision-actions">
                    <button
                      v-if="row.actions.includes('view')"
                      type="button"
                      class="revision-chip"
                      data-flyout-action
                      tabindex="-1"
                      @click="show(row.revision, false)"
                    >
                      View
                    </button>
                    <button
                      v-if="row.actions.includes('diff')"
                      type="button"
                      class="revision-chip"
                      data-testid="revision-diff"
                      data-flyout-action
                      tabindex="-1"
                      @click="show(row.revision, true)"
                    >
                      Diff
                    </button>
                  </span>
                </span>
                <span class="text-[11.5px] text-base-content/70 truncate">{{
                  row.author.name
                }}</span>
              </div>
              <template v-if="revisions">
                <div class="h-px bg-base-300 -mx-1.5 my-1.5" />
                <a
                  :href="back(revisions.href)"
                  target="_self"
                  class="account-item"
                  data-flyout-item
                  role="menuitem"
                >
                  <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h10" />
                  </svg>
                  All revisions
                  <span
                    v-if="revisionCount"
                    class="ml-auto text-[11.5px] text-base-content/50 tabular-nums"
                    >{{ revisionCount }}</span
                  >
                </a>
              </template>
            </div>
          </div>
        </div>
        <a
          v-for="operation of others"
          :key="operation.key"
          :href="back(operation.href)"
          target="_self"
          class="account-item"
          data-menu-item
          role="menuitem"
        >
          <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
          </svg>
          {{ operation.title }}
        </a>

        <template v-if="remove">
          <div class="h-px bg-base-300 -mx-1.5 my-1.5" />
          <button
            type="button"
            class="account-item danger w-full"
            data-menu-item
            role="menuitem"
            @click="confirming = true"
          >
            <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" />
            </svg>
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
      <div
        class="w-full max-w-[400px] bg-base-100 border border-base-300 rounded-2xl shadow-2xl p-5 font-normal text-sm"
      >
        <h2 id="delete-title" class="text-base font-bold tracking-tight mb-2">
          Delete “{{ label }}”?
        </h2>
        <p class="text-[13px] text-base-content/70 leading-relaxed mb-5">
          The page<template v-if="revisionCount"> and its {{ revisionCount }} revisions</template>
          are removed from Drupal. Links to <code class="text-xs">{{ path }}</code> will return 404.
          This can't be undone.
        </p>
        <p v-if="error" class="sign-in-error mb-4" role="alert">{{ error }}</p>
        <div class="flex justify-end gap-2">
          <button
            ref="cancel"
            type="button"
            class="h-9 px-3.5 rounded-lg border border-base-300 font-medium"
            :disabled="deleting"
            @click="cancel"
          >
            Cancel
          </button>
          <button
            type="button"
            class="page-ops-delete h-9 px-3.5 rounded-lg font-semibold"
            :disabled="deleting"
            @click="destroy"
          >
            {{ deleting ? 'Deleting…' : 'Delete page' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import revisionUrl from '~/mixins/revision-url'
import { accountOf } from '~/lib/account'
import { actionsFor, hasDraft, kindOf, versionOf, whenOf } from '~/lib/revisions'

/** How many revisions the flyout lists. */
const RECENT = 5

/**
 * The operations Drupal offers the signed-in user on one entity.
 *
 * Mounted by the `v-druxt-admin` directive in the browser only, so a reader's
 * page carries none of it. Edit and the other screens are Drupal's, served on
 * this origin by the proxy; Revisions lists the latest few to view or diff on
 * the page; Delete is confirmed here and sent over JSON:API.
 */
export default {
  mixins: [revisionUrl],

  props: {
    operations: { type: Array, required: true },
    label: { type: String, default: 'this page' },
    /** The JSON:API resource: `{ type, id }`. */
    resource: { type: Object, default: null },
    /** `bar` renders for the floating editor bar, which is dark and opens upward. */
    variant: { type: String, default: 'page' },
    /** Where Edit goes, when the bar has decided (a block opens the page's form). */
    editHref: { type: String, default: null },
    /** What Edit promises, when the bar has decided. */
    editLabel: { type: String, default: null },
    /** The page's moderation state, when it has one. */
    state: { type: String, default: null },
  },

  data: () => ({ confirming: false, deleting: false, error: null, flyout: false }),

  computed: {
    bar: ({ variant }) => variant === 'bar',
    /** The bar's target when it has one, else Drupal's own link. */
    editTarget: ({ edit, editHref, back }) => editHref || (edit ? back(edit.href) : null),
    editAria: ({ editLabel, label }) => editLabel || `Edit ${label}`,
    byKey: ({ operations }) => Object.fromEntries(operations.map((o) => [o.key, o])),
    edit: ({ byKey }) => byKey['edit-form'] || null,
    revisions: ({ byKey }) => byKey['version-history'] || null,
    remove: ({ byKey, resource }) => (resource && byKey['delete-form']) || null,
    others: ({ operations }) =>
      operations.filter((o) => !['edit-form', 'version-history', 'delete-form'].includes(o.key)),
    /** A pending draft, from the revisions when they are in, else the page's state. */
    draft: ({ allRevisions, state }) =>
      allRevisions.length ? hasDraft(allRevisions) : Boolean(state && state !== 'published'),
    allRevisions: ({ $store }) =>
      ($store && $store.state.editor && $store.state.editor.revisions) || [],
    revisionCount: ({ allRevisions }) => allRevisions.length,
    /** The latest few, each with who made it and when. */
    recent: ({ allRevisions, $store }) =>
      allRevisions.slice(0, RECENT).map((revision) => {
        const actions = actionsFor(revision, allRevisions, $store.state.editor.version)
        return {
          revision,
          kind: kindOf(revision),
          when: whenOf(revision.date),
          actions,
          // The row being read: it has nothing to offer but its own diff.
          viewing: !actions.includes('view'),
          author: accountOf({
            name: (revision.author || {}).name || 'Unknown',
            picture: (revision.author || {}).picture,
          }),
        }
      }),
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
     * A Drupal link that comes back here when it is done. Without it Drupal
     * decides where to go, which is its own page: saving a profile leaves the
     * reader on `/user/2` rather than the page they were reading.
     *
     * @param {string} href - The operation's path.
     * @returns {string} The path with a `destination` back to this page.
     */
    back(href) {
      if (!href) return href
      const to = encodeURIComponent(this.$route.fullPath)
      return `${href}${href.includes('?') ? '&' : '?'}destination=${to}`
    },

    /**
     * E opens the edit form, unless the reader is typing, something has
     * already acted on the key, or the delete dialog is open. The dialog puts
     * focus on its Cancel button, which is not a text field, so without this
     * an E while it is open navigates away and the dialog vanishes unanswered.
     */
    onKey(event) {
      if (this.confirming || event.defaultPrevented) return
      if (
        !this.edit ||
        event.key !== 'e' ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return
      const target = event.target || {}
      if (target.isContentEditable || /^(input|textarea|select)$/i.test(target.tagName || ''))
        return
      window.location.href = this.editTarget
    },

    /**
     * Opens the list on a click, for touch and for a keyboard. Always: the
     * row's href is Drupal's history page, and following it because the list
     * has not arrived yet would take the reader off the site.
     */
    toggleFlyout(event) {
      event.preventDefault()
      const row = event.currentTarget
      this.flyout = !this.flyout
      // The menu is held open by focus, and a tap takes focus off it, so put
      // it back: on the first revision when opening, on the row when closing.
      this.$nextTick(() => {
        const target = (this.flyout && this.items(true)[0]) || row
        if (target && target.focus) target.focus()
      })
    },

    /** The items of whichever list has focus. */
    items(inFlyout) {
      const root = this.$refs.menu || this.$el
      if (!root) return []
      const found = [...root.querySelectorAll(inFlyout ? '[data-flyout-item]' : '[data-menu-item]')]
      return found.filter((el) => el.getClientRects().length)
    },

    focusRow() {
      this.$nextTick(() => this.$refs.revisionsRow && this.$refs.revisionsRow.focus())
    },

    openFlyout(last = false) {
      this.flyout = true
      this.$nextTick(() => {
        const items = this.items(true)
        const target = last ? items[items.length - 1] : items[0]
        if (target) target.focus()
      })
    },

    /**
     * The arrow keys walk the menu, and follow the list to the side it opens
     * on: left into it, right back out. That holds one level deeper too, so
     * left on a revision reaches its View and Diff and right returns to it.
     * Escape closes the list, then the menu.
     */
    onKey(event) {
      const inFlyout = Boolean(event.target.closest('.revisions-flyout'))
      const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
      if (step) {
        event.preventDefault()
        const items = this.items(inFlyout)
        if (!items.length) return
        // From an action, up and down carry on through the rows it sits in.
        const from = event.target.closest('[data-flyout-item]') || event.target
        const at = items.indexOf(from)
        items[(at + step + items.length) % items.length].focus()
        return
      }
      // Left goes deeper, right comes back, the same way the flyout itself
      // opens. A row's own action is View; Diff is only reachable this way,
      // so without it the keyboard can read a revision and never compare one.
      const action = event.target.closest('[data-flyout-action]')
      if (event.key === 'ArrowLeft' && inFlyout && !action) {
        const actions = [...event.target.querySelectorAll('[data-flyout-action]')]
        if (actions.length) {
          event.preventDefault()
          actions[0].focus()
          return
        }
      }
      if (event.key === 'ArrowRight' && action) {
        event.preventDefault()
        const row = action.closest('[data-flyout-item]')
        if (row) row.focus()
        return
      }
      if (event.key === 'ArrowLeft' && !inFlyout) {
        event.preventDefault()
        this.openFlyout()
        return
      }
      if (event.key === 'ArrowRight' && inFlyout) {
        event.preventDefault()
        this.flyout = false
        this.focusRow()
        return
      }
      if (event.key === 'Escape') {
        if (inFlyout || this.flyout) {
          event.preventDefault()
          this.flyout = false
          this.focusRow()
          return
        }
        if (document.activeElement) document.activeElement.blur()
      }
    },

    /** Shows a revision on the page, with its diff against live or without. */
    async show(revision, diff) {
      this.flyout = false
      if (document.activeElement) document.activeElement.blur()
      const was = this.$store.state.editor.version
      this.$store.commit('setEditorCompare', diff)
      const version = versionOf(revision)
      this.$store.commit('setEditorVersion', version)
      // Before the refresh: asyncData reads the query on the way back in.
      await this.carryRevisionInUrl()
      // Only a different revision needs fetching; a refresh would re-render
      // the page under the diff's marks and drop them.
      if (version !== was) this.$nuxt.refresh()
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
