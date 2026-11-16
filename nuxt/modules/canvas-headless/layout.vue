<template>
  <!-- No minimum height: the editor sizes its frame to the page, and a page
       as tall as its frame never lets the frame shrink. -->
  <div class="bg-base-100 text-base-content font-sans antialiased">
    <Nuxt />
  </div>
</template>

<script>
/**
 * The page alone, with the site's type and colours and none of its chrome:
 * what Canvas's editor frames, so an editor arranges the page and not the
 * site around it.
 */
export default {
  name: 'CanvasHeadlessLayout',
}
</script>
