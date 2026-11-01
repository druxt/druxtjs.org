<template>
  <div class="preview-diff-toggle mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" data-diff-ignore>
    <label class="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        class="toggle toggle-sm toggle-primary"
        :checked="compare"
        data-testid="preview-diff-toggle"
        @change="$store.commit('setEditorCompare', $event.target.checked)"
      />
      <span>Show changes against the live page</span>
    </label>
    <span v-if="compare" class="text-base-content/60" aria-live="polite" v-text="status" />
  </div>
</template>

<script>
/**
 * Turns the preview's diff against the live page on and off.
 *
 * It sits in the preview's own frame, because Consumer Node Preview's bar
 * takes no controls from a site yet. The preview URL's `diff` query starts it
 * on, so a link or a later control in that bar can ask for it.
 * components/app/PageDiff.vue draws the diff.
 */
export default {
  name: 'AppPreviewDiffToggle',

  computed: {
    editor: ({ $store }) => $store.state.editor,
    compare: ({ editor }) => editor.compare,
    /** What the comparison found, once it has. */
    status: ({ editor }) => {
      const diff = editor.diff
      if (!diff) return 'Comparing...'
      if (diff.error) return 'The changes could not be loaded.'
      const { added = 0, removed = 0, changed = 0, moved = 0 } = diff.summary || {}
      const blocks = added + removed + changed + moved
      const fields = (diff.rootFields || []).filter((field) => field.status === 'changed').length
      const total = blocks + fields
      if (!total) return 'No changes from the live page.'
      return `${total} ${total === 1 ? 'change' : 'changes'} from the live page.`
    },
  },

  mounted() {
    if (this.$route.query.diff) this.$store.commit('setEditorCompare', true)
  },
}
</script>
