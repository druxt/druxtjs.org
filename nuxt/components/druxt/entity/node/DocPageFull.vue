<template>
  <!-- .nuxt-content so content-links.client.js routes internal links, as it does for markdown. -->
  <div class="nuxt-content">
    <slot name="field_content" />
  </div>
</template>

<script>
/** A documentation page's body. The page component renders its title and description. */
export default {
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
