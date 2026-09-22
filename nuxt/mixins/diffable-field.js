/**
 * A field wrapper's own diff, from the editor's compare state. Returns null
 * unless comparing and this block's content changed, so `v-diff` is a no-op
 * the rest of the time.
 */
export default {
  computed: {
    editorDiffBlock() {
      const editor = this.$store && this.$store.state.editor
      if (!editor || !editor.compare || !editor.diff || !this.entity) return null
      return (editor.diff.blocks || []).find((b) => b.uuid === this.entity.id && b.status === 'changed') || null
    },
  },
  methods: {
    fieldDiff(name) {
      const block = this.editorDiffBlock
      return block ? block.fields.find((f) => f.name === name) || null : null
    },
  },
}
