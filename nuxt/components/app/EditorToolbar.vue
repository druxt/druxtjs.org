<template>
  <!-- Only for a signed-in editor. A slim bar pinned to the bottom, clear of the sticky header. -->
  <div
    v-if="$auth && $auth.loggedIn"
    class="fixed inset-x-0 bottom-0 z-[55] border-t border-base-300 bg-base-200/95 backdrop-blur"
    data-testid="editor-toolbar"
  >
    <div class="max-w-[110rem] mx-auto h-12 px-4 sm:px-6 flex items-center gap-3 text-sm">
      <span class="font-medium hidden sm:inline">Editing</span>

      <!-- The current view, so it is obvious when the page is not the live one. -->
      <span class="badge badge-sm" :class="stateClass" data-testid="editor-state">{{ stateLabel }}</span>

      <!-- The revision switcher: published, the latest draft, then history. -->
      <label class="sr-only" for="editor-version">View revision</label>
      <select
        id="editor-version"
        v-model="version"
        class="select select-bordered select-sm min-w-0 max-w-[16rem]"
        data-testid="editor-version"
      >
        <option value="published">Published (live)</option>
        <option v-if="hasDraft" value="working-copy">Latest draft</option>
        <optgroup v-if="history.length" label="History">
          <option v-for="rev of history" :key="rev.vid" :value="`id:${rev.vid}`">
            {{ revisionLabel(rev) }}
          </option>
        </optgroup>
      </select>

      <div class="flex-1" />

      <span class="text-base-content/70 hidden md:inline truncate max-w-[12rem]" data-testid="editor-account">{{ accountName }}</span>
      <button type="button" class="btn btn-ghost btn-sm" data-testid="editor-signout" @click="signOut">Sign out</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AppEditorToolbar',

  data: () => ({ loading: false }),

  computed: {
    /** The page's editor context, set by fetchDrupalPage: { uuid, nid, moderationState }. */
    page: ({ $store }) => $store.state.editor.page,

    revisions: ({ $store }) => $store.state.editor.revisions,

    /** The selected view, read from and written to the store. Changing it re-fetches the page. */
    version: {
      get() {
        return this.$store.state.editor.version
      },
      set(value) {
        if (value === this.$store.state.editor.version) return
        this.$store.commit('setEditorVersion', value)
        this.$nuxt.refresh()
      },
    },

    /** Whether the page has an unpublished later revision to offer as "Latest draft". */
    hasDraft() {
      const latest = this.revisions[0]
      return Boolean(latest && latest.latest && !latest.default)
    },

    /** Past revisions, offered by id in the History group. */
    history() {
      return this.revisions
    },

    accountName: ({ $auth }) => ($auth.user && ($auth.user.name || $auth.user.preferred_username || $auth.user.email)) || 'Signed in',

    stateLabel() {
      if (this.version === 'published') return 'Published'
      if (this.version === 'working-copy') return 'Draft'
      const vid = String(this.version).replace(/^id:/, '')
      const rev = this.revisions.find((r) => String(r.vid) === vid)
      return rev && rev.default ? `Revision ${vid}` : `Revision ${vid} (unpublished)`
    },

    stateClass() {
      return this.version === 'published' ? 'badge-success badge-outline' : 'badge-warning'
    },
  },

  watch: {
    // The page's revisions follow the page; fetch them when it changes.
    'page.uuid': {
      immediate: true,
      handler(uuid) {
        if (uuid) this.loadRevisions(uuid)
      },
    },
  },

  methods: {
    /** A revision's label: its date, and its state when it is not published. */
    revisionLabel(rev) {
      const date = rev.date ? new Date(rev.date).toLocaleDateString() : `#${rev.vid}`
      const tag = rev.default ? 'live' : rev.published ? 'published' : rev.state || 'draft'
      return `${date} · ${tag}`
    },

    async loadRevisions(uuid) {
      this.loading = true
      try {
        const { data } = await this.$druxt.axios.get(`/druxt-docs/doc-page/${uuid}/revisions`)
        this.$store.commit('setEditorRevisions', (data && data.data) || [])
      } catch (e) {
        // No list is not fatal: the published/draft toggle still works.
        this.$store.commit('setEditorRevisions', [])
      } finally {
        this.loading = false
      }
    },

    signOut() {
      this.$signOut()
    },
  },
}
</script>
