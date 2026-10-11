<template>
  <div
    v-if="previewing"
    class="bg-warning/15 border-b border-warning/40 px-4 py-2 text-center text-sm text-base-content"
    role="status"
    data-testid="workspace-preview-notice"
  >
    You are previewing staged content from a workspace. It is not live yet, and the preview link expires.
  </div>
</template>

<script>
/**
 * Tells a reviewer who followed a workspace preview link what they see.
 *
 * The link's cookie makes Drupal read the site in that workspace for them,
 * and nothing else on the page would say so: the editor bar shows to a
 * signed-in editor only. The flag is set on the server render, since the
 * cookie is HttpOnly.
 */
export default {
  computed: {
    previewing() {
      return Boolean(this.$store.state.editor.previewing)
    },
  },
}
</script>
