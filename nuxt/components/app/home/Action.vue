<template>
  <NuxtLink class="btn gap-2" :class="variant === 'primary' ? 'btn-primary' : 'btn-ghost'" :to="url">
    <component :is="`app-icon-${icon}`" v-if="icon && icon !== 'none'" class="w-5 h-5" /> {{ label }}
  </NuxtLink>
</template>

<script>
/** A button that links to a page of the site, with an optional icon. */
export default {
  props: {
    label: { type: String, default: '' },
    url: { type: String, default: '/' },
    variant: { type: String, default: 'ghost' },
    icon: { type: String, default: 'none' },
  },
}
</script>
