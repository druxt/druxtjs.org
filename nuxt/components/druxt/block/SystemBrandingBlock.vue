<template>
  <NuxtLink to="/" class="flex items-center gap-2 flex-shrink-0 rounded-btn px-1 py-1 hover:opacity-80">
    <!-- The logo is not square, so only its height is set. -->
    <img v-if="settings.use_site_logo && logo" :src="logo" alt="" class="h-7 w-auto flex-shrink-0" />
    <span v-if="settings.use_site_name" class="text-lg sm:text-xl font-semibold tracking-tight whitespace-nowrap">{{ site.name }}</span>
  </NuxtLink>
</template>

<script>
/** The site branding block: the logo and site name, from the consumer's decoupled settings. */
export default {
  props: {
    block: { type: Object, required: true },
  },
  computed: {
    settings: ({ block }) => block.attributes.settings || {},
    site: ({ $config }) => ($config.decoupledSettings || {})['system.site'] || {},
    logo: ({ $config }) => {
      const theme = ($config.decoupledSettings || {})[($config.decoupledTheme || {}).settings_object] || {}
      return (theme.logo || {}).url
    },
  },
}
</script>
