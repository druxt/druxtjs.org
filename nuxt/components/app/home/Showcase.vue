<template>
  <section class="border-t border-base-300 bg-base-200">
    <div class="max-w-5xl mx-auto px-6 py-20 grid gap-12 items-center lg:grid-cols-[1fr,20rem]">
      <NuxtLink :to="linkUrl" class="block rounded-box border border-base-300 bg-base-100 overflow-hidden hover:border-primary hover:shadow-lg transition">
        <picture>
          <source v-if="webp" :srcset="webp" type="image/webp">
          <img :src="imageSrc" :alt="imageAlt" class="block w-full h-auto" width="1440" height="900">
        </picture>
      </NuxtLink>

      <div>
        <h2 class="text-2xl font-semibold" v-text="heading" />
        <p v-if="text" class="mt-4 text-base-content/70" v-text="text" />
        <p v-if="detail" class="mt-3 text-sm text-base-content/70" v-text="detail" />
        <NuxtLink v-if="linkText" class="btn btn-primary btn-sm mt-6" :to="linkUrl">{{ linkText }}</NuxtLink>
      </div>
    </div>
  </section>
</template>

<script>
/**
 * A screenshot beside a heading, two paragraphs and a button. The screenshot
 * is one of the site's own images, which have a WebP copy beside the PNG.
 */
export default {
  props: {
    heading: { type: String, default: '' },
    text: { type: String, default: '' },
    detail: { type: String, default: '' },
    linkText: { type: String, default: '' },
    linkUrl: { type: String, default: '/' },
    imageSrc: { type: String, default: '' },
    imageAlt: { type: String, default: '' },
  },

  computed: {
    webp: ({ imageSrc }) => (/^\/images\/.+\.png$/.test(imageSrc) ? imageSrc.replace(/\.png$/, '.webp') : null),
  },
}
</script>
