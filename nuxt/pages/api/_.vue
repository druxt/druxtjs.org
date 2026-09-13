<template>
  <article>

    <!-- Skipped on a package's API root: the layout's module header there
         carries the same title and the same source link. -->
    <AppPageHeader v-if="!inModuleHeader" :title="document.title">
      <a
        v-if="source"
        class="mt-5 inline-flex items-center gap-2 text-sm text-base-content/70 hover:text-primary-focus"
        :href="source"
        target="_blank"
        rel="noopener"
      >
        <AppIconExternal class="w-4 h-4" /> View source on GitHub
      </a>
    </AppPageHeader>

    <AppProse :document="document" />

    <!-- A component's page ends with the component itself, live. -->
    <section v-if="example" class="mt-12">
      <h2 id="try-it" class="text-xl font-semibold">Try it</h2>
      <DruxtExample :component="example" />
    </section>
  </article>
</template>

<script>
import { seoHead } from '~/utils/seo'
import { apiSourceUrl } from '~/utils/api-source'
import { documentDescription } from '~/utils/content'
import { knowsComponent } from '~/utils/live-examples'
import { isPackageRoot } from '~/components/app/icon/module'
export default {
  name: 'AppApiDocument',

  async asyncData({ $content, error, params, store, route }) {
    let path = params.pathMatch || 'README'
    if (path.endsWith('/')) path += 'index'

    let document
    try {
      document = await $content('api/', path).fetch()
      if (Array.isArray(document)) {
        document = await $content('api/', params.pathMatch + '/index').fetch()
      }
    } catch (e) {
      return error({ statusCode: 404, message: 'Document not found' })
    }

    store.commit('addRecent', { text: document.title, to: route.path })
    // The document's own headings, then the live card this page adds.
    const isComponent = /\/components$/.test(document.dir || '') && knowsComponent(document.slug)
    store.commit('setToc', [...(document.toc || []), ...(isComponent ? [{ id: 'try-it', depth: 2, text: 'Try it' }] : [])])

    return { document }
  },

  head() {
    return seoHead({
      title: this.document.title,
      description: documentDescription(this.document),
      path: this.$route.path,
    })
  },

  computed: {
    /**
     * Whether the layout's module header above already names this page.
     *
     * @param {object} vm - The component ViewModel.
     * @param {object} vm.$route - The current route.
     * @returns {boolean} True on a module package's API root.
     */
    inModuleHeader: ({ $route }) => isPackageRoot($route.path),

    source: ({ document }) => apiSourceUrl(document.dir, document.slug),

    /** The component this page documents, when it has a live card. */
    example: ({ document }) => (/\/components$/.test(document.dir || '') && knowsComponent(document.slug) ? document.slug : null),
  },
}
</script>
