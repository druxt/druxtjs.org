<template>
  <!-- Where whole blocks were removed, a marker in the margin opens to what was there. -->
  <div v-if="active && removed.length" class="page-diff-removed" aria-live="polite">
    <div
      v-for="marker of removed"
      :key="marker.key"
      class="absolute z-30"
      :style="{ top: marker.top + 'px', left: marker.left + 'px', width: marker.width + 'px' }"
    >
      <button
        type="button"
        class="page-diff-removed-dot"
        :aria-expanded="String(open === marker.key)"
        :aria-label="`${marker.blocks.length} removed ${marker.blocks.length === 1 ? 'block' : 'blocks'}`"
        @click="open = open === marker.key ? null : marker.key"
      >−</button>
      <div v-if="open === marker.key" class="page-diff-removed-card">
        <p class="text-xs font-semibold mb-2">Removed</p>
        <div v-for="(block, i) of marker.blocks" :key="i" class="mb-2 last:mb-0">
          <AppDiffField v-for="field of block.fields" :key="field.name" :field="field" :condense="false" />
          <p v-if="!block.fields.length" class="text-xs text-base-content/60">A block with nothing to compare.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { normaliseDiff } from '~/lib/diff'
import { findAnchor } from '~/lib/anchors'
import { viewing } from '~/lib/revisions'

/** The margin mark each block status gets. */
const MARKED = ['changed', 'added', 'moved']

/**
 * The page's diff against live, drawn on the page.
 *
 * jsonapi_diff compares the revision on screen with the live one, and
 * @druxt-contrib/diff's normaliseDiff() turns that into blocks. A changed
 * field is marked word by word by `v-diff` in the paragraph's own wrapper
 * (mixins/diffable-field.js); this adds the rule in the margin beside each
 * changed block, and a marker where a block is gone.
 */
export default {
  name: 'AppPageDiff',

  data: () => ({ removed: [], open: null, marked: [] }),

  computed: {
    editor: ({ $store }) => $store.state.editor,
    signedIn: ({ $auth }) => Boolean($auth && $auth.loggedIn),
    shown: ({ editor }) => viewing(editor.revisions, editor.version),
    /** On while comparing something other than live itself. */
    active: ({ signedIn, editor, shown }) => signedIn && editor.compare && shown.kind !== 'live',
    /** The jsonapi_diff version on the right: the draft, or a revision by id. */
    rightVersion: ({ shown }) => (shown.kind === 'draft' ? 'rel:working-copy' : shown.revision ? `id:${shown.revision.vid}` : null),
    key: ({ editor, rightVersion, active }) => (active && editor.page ? `${editor.page.uuid}@${rightVersion}` : null),
  },

  watch: {
    key: {
      handler(key) {
        this.clear()
        this.$store.commit('setEditorDiff', null)
        if (key) this.load()
      },
    },
    'editor.diff'() {
      // Paragraphs render after the diff lands; let them, then mark.
      this.$nextTick(() => setTimeout(() => this.mark(), 250))
    },
  },

  mounted() {
    this.onResize = () => this.mark()
    window.addEventListener('resize', this.onResize)
    if (this.key) this.load()
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.onResize)
    this.clear()
  },

  methods: {
    async load() {
      const key = this.key
      try {
        const { data } = await this.$druxt.axios.get(`/jsonapi/diff/node/doc_page/${this.editor.page.uuid}`, {
          params: { leftVersion: 'rel:latest-version', rightVersion: this.rightVersion },
          headers: { Accept: 'application/vnd.api+json' },
        })
        const view = normaliseDiff(data)
        // `v-diff` marks what is rendered when the diff arrives, so hand it
        // over once the changed blocks are on the page.
        await this.rendered(view)
        if (key === this.key) this.$store.commit('setEditorDiff', view)
      } catch (e) {
        if (key === this.key) this.$store.commit('setEditorDiff', { error: true, blocks: [], rootFields: [] })
      }
    },

    /** Resolves once every changed block is rendered with its text, or after a few seconds. */
    rendered(view) {
      const uuids = (view.blocks || []).filter((b) => b.status === 'changed').map((b) => b.uuid)
      const ready = () => uuids.every((uuid) => {
        const el = findAnchor(document, { entity: uuid })
        return el && el.textContent.trim()
      })
      return new Promise((resolve) => {
        const started = Date.now()
        const check = () => (ready() || Date.now() - started > 6000 ? setTimeout(resolve, 100) : setTimeout(check, 150))
        check()
      })
    },

    clear() {
      for (const el of this.marked) el.removeAttribute('data-diff')
      this.marked = []
      this.removed = []
      this.open = null
    },

    /** Margin rules on the blocks still on the page, and markers for the ones that are not. */
    mark() {
      const diff = this.editor.diff
      for (const el of this.marked) el.removeAttribute('data-diff')
      this.marked = []
      if (!this.active || !diff || !diff.blocks) return

      for (const block of diff.blocks) {
        if (!MARKED.includes(block.status)) continue
        const el = findAnchor(document, { entity: block.uuid })
        if (!el) continue
        el.setAttribute('data-diff', block.status)
        this.marked.push(el)
      }

      // Removed blocks, grouped by the surviving block they sat beside.
      const groups = new Map()
      for (const block of diff.rebuilt ? [] : diff.blocks) {
        if (block.status !== 'removed') continue
        const anchor = block.placeAfter || block.placeBefore
        if (!anchor) continue
        const side = block.placeAfter ? 'after' : 'before'
        const key = `${side}:${anchor}`
        if (!groups.has(key)) groups.set(key, { key, anchor, side, blocks: [] })
        groups.get(key).blocks.push(block)
      }
      const removed = []
      for (const group of groups.values()) {
        const el = findAnchor(document, { entity: group.anchor })
        if (!el) continue
        const r = el.getBoundingClientRect()
        removed.push({
          key: group.key,
          blocks: group.blocks,
          top: (group.side === 'after' ? r.bottom : r.top) + window.scrollY - 8,
          left: r.left + window.scrollX - 34,
          width: Math.max(r.width, 320),
        })
      }
      this.removed = removed
    },
  },
}
</script>
