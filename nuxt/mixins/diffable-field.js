import { blockFor } from '~/lib/diff-anchors'

/**
 * A field wrapper's own diff, from the editor's compare state. Returns null
 * unless comparing and this block's content changed, so `v-diff` is a no-op
 * the rest of the time.
 *
 * The block is found by either of its uuids, because which side a page
 * renders is not always the side that was asked for: a listing whose body
 * stays the live content still has a diff, and its elements carry the left
 * uuid.
 */
export default {
  computed: {
    editorDiffBlock() {
      const editor = this.$store && this.$store.state.editor
      if (!editor || !editor.compare || !editor.diff || !this.entity) return null
      return blockFor(editor.diff.blocks, this.entity.id, 'changed')
    },
  },
  methods: {
    fieldDiff(name) {
      const block = this.editorDiffBlock
      return block ? block.fields.find((f) => f.name === name) || null : null
    },
  },
}
