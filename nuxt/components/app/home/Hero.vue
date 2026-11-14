<template>
  <section class="border-b border-base-300 bg-base-200">
    <div class="max-w-5xl mx-auto px-6 py-24 sm:py-28 text-center flex flex-col items-center">
      <AppLogo class="w-20 mb-7" title="DruxtJS" />
      <h1 class="text-4xl sm:text-5xl font-bold tracking-tight" v-text="heading" />
      <p v-if="lead" class="mt-4 text-lg text-base-content/70 max-w-xl" v-text="lead" />
      <p v-if="note || noteLinkText" class="mt-2 text-sm text-base-content/60">
        {{ note }}
        <NuxtLink v-if="noteLinkText && noteLinkUrl" class="underline hover:text-primary-focus" :to="noteLinkUrl">{{ noteLinkText }}</NuxtLink><template v-if="noteLinkText">.</template>
      </p>
      <div v-if="$slots.actions" class="mt-9 flex flex-wrap items-center justify-center gap-3">
        <slot name="actions" />
      </div>
      <div class="w-full">
        <slot />
      </div>
    </div>
  </section>
</template>

<script>
/**
 * The front page's hero: the logo, a heading, a lead, a note with a link,
 * a row of actions and whatever follows them.
 */
export default {
  props: {
    heading: { type: String, default: '' },
    lead: { type: String, default: '' },
    note: { type: String, default: '' },
    noteLinkText: { type: String, default: '' },
    noteLinkUrl: { type: String, default: '' },
  },
}
</script>
