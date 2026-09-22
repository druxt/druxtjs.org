<template>
  <!-- Only while an editor is looking at something other than the live page. -->
  <transition name="fade">
    <div v-if="visible" class="revision-pill" role="region" aria-label="Revision" data-testid="revision-pill" data-diff-ignore>
      <template v-if="shown.kind === 'draft'">
        <span>{{ editor.compare ? 'Draft vs live' : 'Viewing the draft' }}</span>
      </template>
      <template v-else>
        <AppAvatar v-if="author" :account="author" :size="24" />
        <span>{{ when }}<template v-if="author"> · {{ author.name }}</template></span>
      </template>

      <template v-if="editor.compare && editor.diff && !editor.diff.error">
        <span class="revision-pill-count" :aria-label="countLabel">
          <span v-if="counts.changed" class="changed">~{{ counts.changed }}</span>
          <span v-if="counts.added" class="added">+{{ counts.added }}</span>
          <span v-if="counts.removed" class="removed">−{{ counts.removed }}</span>
          <span v-if="!total">No changes</span>
        </span>
        <template v-if="total">
          <span class="revision-pill-rule" aria-hidden="true" />
          <span class="flex">
            <button type="button" class="revision-pill-nav" aria-label="Previous change" @click="step(-1)">
              <svg class="account-icon !text-current !w-3.5 !h-3.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 15l-6-6-6 6" /></svg>
            </button>
            <button type="button" class="revision-pill-nav" aria-label="Next change" @click="step(1)">
              <svg class="account-icon !text-current !w-3.5 !h-3.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </span>
        </template>
      </template>
      <span v-else-if="editor.compare && editor.diff && editor.diff.error" class="opacity-80">Couldn't compare</span>

      <button type="button" class="revision-pill-btn ghost" data-testid="revision-pill-diff" :aria-label="diffLabel" @click="toggleDiff">
        <span class="label">{{ diffLabel }}</span>
        <svg class="icon account-icon !text-current !w-4 !h-4" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
          <path v-if="editor.compare" d="M4 4l16 16" />
        </svg>
      </button>
      <button type="button" class="revision-pill-btn solid" data-testid="revision-pill-exit" @click="exit">Exit</button>
    </div>
  </transition>
</template>

<script>
import { accountOf } from '~/lib/account'
import { viewing, whenOf } from '~/lib/revisions'

/**
 * The pill at the bottom of the page while an editor views a draft or an old
 * revision: what it is, its diff against live, and the way back to live.
 *
 * It also keeps the page's revisions in the store, for the Revisions submenu
 * and the Draft label beside the title.
 */
export default {
  name: 'AppRevisionPill',

  data: () => ({ cursor: -1 }),

  computed: {
    editor: ({ $store }) => $store.state.editor,
    signedIn: ({ $auth }) => Boolean($auth && $auth.loggedIn),
    uuid: ({ editor }) => (editor.page || {}).uuid,
    shown: ({ editor }) => viewing(editor.revisions, editor.version),
    visible: ({ signedIn, uuid, shown }) => signedIn && Boolean(uuid) && shown.kind !== 'live',
    author: ({ shown }) => (shown.revision && shown.revision.author ? accountOf({ name: shown.revision.author.name, picture: shown.revision.author.picture }) : null),
    when: ({ shown }) => (shown.revision ? whenOf(shown.revision.date) : 'An earlier revision'),
    counts: ({ editor }) => {
      const diff = editor.diff || {}
      const blocks = diff.blocks || []
      const count = (status) => blocks.filter((b) => b.status === status).length
      const root = (diff.rootFields || []).length
      return { changed: count('changed') + count('moved') + root, added: count('added'), removed: count('removed') }
    },
    diffLabel: ({ editor, shown }) => (editor.compare ? 'Hide diff' : shown.kind === 'draft' ? 'Show diff' : 'Diff with live'),
    total: ({ counts }) => counts.changed + counts.added + counts.removed,
    countLabel: ({ counts }) => `${counts.changed} changed, ${counts.added} added, ${counts.removed} removed`,
  },

  watch: {
    uuid: {
      immediate: true,
      handler(uuid) {
        if (uuid && this.signedIn) this.loadRevisions(uuid)
      },
    },
    'editor.version'() {
      this.cursor = -1
    },
  },

  methods: {
    async loadRevisions(uuid) {
      try {
        const { data } = await this.$druxt.axios.get(`/druxt-docs/doc-page/${uuid}/revisions`)
        this.$store.commit('setEditorRevisions', (data && data.data) || [])
      } catch (e) {
        // Without the list there is no submenu, and the page still reads.
        this.$store.commit('setEditorRevisions', [])
      }
    },

    toggleDiff() {
      this.$store.commit('setEditorCompare', !this.editor.compare)
    },

    exit() {
      this.$store.commit('setEditorCompare', false)
      this.$store.commit('setEditorVersion', 'published')
      this.$nuxt.refresh()
    },

    /** Scrolls to the next or previous change on the page. */
    step(direction) {
      const targets = [...document.querySelectorAll('[data-diff], .page-diff-removed-dot, main header ins, main header del')]
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
      if (!targets.length) return
      this.cursor = (this.cursor + direction + targets.length) % targets.length
      const target = targets[this.cursor]
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3, behavior: 'smooth' })
      target.classList.remove('diff-flash')
      void target.offsetWidth
      target.classList.add('diff-flash')
    },
  },
}
</script>
