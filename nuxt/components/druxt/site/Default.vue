<template>
  <!-- Every region the theme has, named, in the order Drupal lists them. -->
  <div class="druxt-site">
    <section v-for="region in regions" :key="region" class="druxt-site-region">
      <p class="druxt-site-region-name">{{ region }}</p>
      <slot :name="region" />
    </section>
  </div>
</template>

<script>
/** The default site wrapper: the theme's regions, each labelled, with its blocks. */
export default {
  props: {
    props: { type: Object, default: () => ({}) },
    regions: { type: Array, default: () => [] },
    theme: { type: String, default: '' },
  },
}
</script>
