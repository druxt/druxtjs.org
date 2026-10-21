<template>
  <div class="min-h-screen bg-base-100 text-base-content font-sans antialiased">
    <main id="main" class="px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div class="mx-auto max-w-content">
        <Nuxt />
      </div>
    </main>
  </div>
</template>

<script>
/**
 * The page alone, with the site's type and spacing and none of its chrome.
 *
 * A preview's Layout picker switches the frame to it, so an editor sees the
 * content as content, without the header, sidebar, footer and editor bar
 * around it.
 */
export default {
  name: 'PreviewLayout',
}
</script>
