<template>
  <!--
    The site-wide footer; AppDocFooter is the per-document one. Colours come
    from theme tokens, so a palette change carries through here.
  -->
  <footer class="border-t border-base-300 bg-base-200 text-base-content">
    <div class="max-w-[110rem] mx-auto px-4 sm:px-6 py-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <NuxtLink to="/" class="flex items-center gap-2 w-max rounded-btn hover:opacity-80">
          <AppLogo class="w-6" title="DruxtJS" />
          <span class="text-base font-semibold tracking-tight">DruxtJS</span>
        </NuxtLink>
        <p class="mt-3 text-sm text-base-content/70 max-w-xs">
          The fully decoupled Drupal framework, for Nuxt.
        </p>
        <p v-if="version" class="mt-3">
          <NuxtLink
            class="badge badge-sm badge-outline hover:border-primary hover:text-primary-focus"
            to="/api/packages/druxt/CHANGELOG"
            :title="'Druxt ' + version + ' release notes'"
          >{{ version }}</NuxtLink>
        </p>
      </div>

      <!-- The footer menu is a Drupal block, placed in the footer region of the consumer's theme. -->
      <DruxtBlockRegion v-if="theme" name="footer" :theme="theme" class="lg:col-span-2" />
    </div>

    <div class="border-t border-base-300">
      <div class="max-w-[110rem] mx-auto px-4 sm:px-6 py-4 text-xs text-base-content/70">
        Released under the MIT licence.
      </div>
    </div>
  </footer>
</template>

<script>
export default {
  props: {
    /** e.g. "v0.24.0"; the badge is hidden when the version is unavailable. */
    version: { type: String, default: null },
  },

  computed: {
    /** The consumer's theme, from the decoupled settings theme manifest. */
    theme: ({ $config }) => ($config.decoupledTheme || {}).default,
  },
}
</script>
