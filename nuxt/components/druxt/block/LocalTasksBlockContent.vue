<template>
  <!-- Drupal's local tasks are View, Edit and Revisions for the thing on the
       page, which is what the editor bar offers. The bar renders from the
       layout rather than from here, because it has to be reachable on every
       page, including the ones Drupal does not hold, and a block only renders
       where its region does. -->
  <div class="rounded-md border border-dashed border-base-300 px-4 py-3 text-sm text-base-content/70">
    The editor bar renders these, for a signed-in editor.
  </div>
</template>

<script>
/**
 * The local tasks block.
 *
 * Without a wrapper a block falls back to the default one, which describes
 * the block by naming its plugin and listing its settings. That is right for
 * a block nothing renders yet and wrong for this one, which has a rendering:
 * the editor bar.
 */
export default {
  props: {
    block: { type: Object, required: true },
  },
}
</script>
