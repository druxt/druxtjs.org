import { anchorUuid } from '~/lib/diff'

/**
 * A field wrapper's own diff, from the editor's compare state. Returns null
 * unless comparing and this block's content changed, so `v-diff` is a no-op
 * the rest of the time.
 *
 * The block is found by the uuid on the side the page renders, which is the
 * right one: a rebuilt paragraph has a different uuid on each side.
 */
export default {
  computed: {
    editorDiffBlock() {
      const editor = this.$store && this.$store.state.editor
      if (!editor || !editor.compare || !editor.diff || !this.entity) return null
      return (editor.diff.blocks || []).find((b) => anchorUuid(b, 'right') === this.entity.id && b.status === 'changed') || null
    },
  },
  methods: {
    fieldDiff(name) {
      const block = this.editorDiffBlock
      return block ? block.fields.find((f) => f.name === name) || null : null
    },
  },
}
