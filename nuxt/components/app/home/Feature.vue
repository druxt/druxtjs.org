<template>
  <div>
    <component :is="`app-icon-${icon}`" v-if="icon && icon !== 'none'" class="w-6 h-6 mb-3 text-primary-focus" />
    <h2 class="text-lg font-semibold" v-text="heading" />
    <p class="mt-2 text-sm text-base-content/70">
      {{ text }}
      <NuxtLink v-if="linkUrl && linkText" :to="linkUrl" v-text="linkText" />
    </p>
  </div>
</template>

<script>
/** One feature of the front page's grid: an icon, a heading and a sentence. */
export default {
  props: {
    icon: { type: String, default: 'none' },
    heading: { type: String, default: '' },
    text: { type: String, default: '' },
    linkText: { type: String, default: '' },
    linkUrl: { type: String, default: '' },
  },
}
</script>
