<template>
  <div>
    <!-- On the module's own route the layout header already names it. -->
    <AppPageHeader v-if="document && !inModuleHeader" :title="document.title" :description="document.description" />

    <!-- Every module README opens with a screenshot; it becomes the hero. -->
    <AppFigure v-if="hero" :src="hero.src" :alt="hero.alt" class="mb-8" />

    <AppProse v-if="document" :document="document" />

    <AppApiIndex v-if="pkg" :pkg="pkg" class="mt-12" />

    <AppDocFooter :edit-path="editPath" />
  </div>
</template>

<script>
import { seoHead } from '~/utils/seo'
import { documentDescription, extractHero } from '~/utils/content'
import { isPackageRoot } from '~/components/app/icon/module'

export default {
  name: 'AppModuleDocument',

  // Supplied by pages/modules.vue via <NuxtChild>.
  props: {
    pkg: { type: String, default: null },
  },

  async asyncData({ $content, error, params, store, route }) {
    // Trim the trailing slash, so `/modules/entity/` resolves like `/modules/entity`.
    const match = (params.pathMatch || '').replace(/\/+$/, '')
    const slug = match
      ? (match.includes('/') ? match : match + '/README')
      : 'README'

    let document
    try {
      document = await $content('modules/', slug).fetch()
      // A directory returns its listing, so ask for the index file instead.
      if (Array.isArray(document)) {
        document = await $content('modules/', slug + '/index').fetch()
      }
    } catch (e) {
      return error({ statusCode: 404, message: 'Document not found' })
    }

    const { hero, body } = extractHero(document)

    store.commit('addRecent', { text: document.title, to: route.path })
    store.commit('setToc', document.toc || [])

    return { document: { ...document, body }, hero, slug }
  },

  head() {
    return seoHead({
      title: this.document.title,
      description: documentDescription(this.document),
      path: this.$route.path,
    })
  },

  computed: {
    editPath: ({ slug }) => 'modules/' + slug + '.md',

    /** Whether the layout header above already names this page. */
    inModuleHeader: ({ $route }) => isPackageRoot($route.path),
  },
}
</script>
