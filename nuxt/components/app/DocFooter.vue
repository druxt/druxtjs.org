<template>
  <footer v-if="prev || next" class="mt-12 pt-6 border-t border-base-300">
    <div class="grid gap-3 sm:grid-cols-2">
      <NuxtLink
        v-if="prev"
        :to="prev.to"
        class="group rounded-box border border-base-300 p-4 hover:border-primary transition-colors"
      >
        <span class="block text-xs uppercase tracking-wider text-base-content/70">Previous</span>
        <span class="block mt-1 font-medium group-hover:text-primary-focus" v-text="prev.text" />
      </NuxtLink>
      <span v-else />

      <NuxtLink
        v-if="next"
        :to="next.to"
        class="group rounded-box border border-base-300 p-4 text-right hover:border-primary transition-colors sm:col-start-2"
      >
        <span class="block text-xs uppercase tracking-wider text-base-content/70">Next</span>
        <span class="block mt-1 font-medium group-hover:text-primary-focus" v-text="next.text" />
      </NuxtLink>
    </div>
  </footer>
</template>

<script>
export default {
  props: {
    prev: { type: Object, default: null },
    next: { type: Object, default: null },
  },
}
</script>
