<template>
  <section v-if="modules.length" class="border-t border-base-300 bg-base-200">
    <div class="max-w-5xl mx-auto px-6 py-20">
      <div class="flex items-end justify-between gap-4 mb-8">
        <div>
          <h2 class="text-2xl font-semibold" v-text="heading" />
          <p v-if="text" class="mt-1 text-base-content/70" v-text="text" />
        </div>
        <NuxtLink v-if="linkText" class="btn btn-sm btn-ghost" :to="linkUrl">{{ linkText }}</NuxtLink>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AppModuleCard v-for="module of modules" :key="module.title" :module="module" />
      </div>
    </div>
  </section>
</template>

<script>
/** The site's modules as cards, under a heading and a link to all of them. */
export default {
  props: {
    heading: { type: String, default: '' },
    text: { type: String, default: '' },
    linkText: { type: String, default: '' },
    linkUrl: { type: String, default: '/modules' },
  },

  computed: {
    modules: ({ $store }) => $store.state.modules,
  },
}
</script>
