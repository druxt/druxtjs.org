<template>
  <div>
    <!-- On the module's own route the layout header already names it. -->
    <AppPageHeader v-if="document && !inModuleHeader" :title="document.title" :description="document.description" />

    <!-- Every module README opens with a screenshot; it becomes the hero. -->
    <AppFigure v-if="hero" :src="hero.src" :alt="hero.alt" class="mb-8" />

    <AppProse v-if="document" :document="document" />

    <!-- The module's own components, live, on its root page. -->
    <section v-if="pkg && inModuleHeader && liveComponents.length" class="mt-12">
      <h2 id="try-it" class="text-xl font-semibold">Try it</h2>
      <DruxtExample :pkg="pkg" />
    </section>

    <AppApiIndex v-if="pkg" :pkg="pkg" class="mt-12" />
  </div>
</template>

<script>
import { seoHead } from '~/utils/seo'
import { documentDescription, extractHero } from '~/utils/content'
import { liveComponentsOf } from '~/utils/live-examples'
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
    // The document's own headings, then the sections this page adds under them.
    const [, , pkg] = route.path.split('/')
    const added = pkg && isPackageRoot(route.path)
      ? [
          ...(liveComponentsOf(pkg).length ? [{ id: 'try-it', depth: 2, text: 'Try it' }] : []),
          { id: 'api-reference', depth: 2, text: 'API reference' },
        ]
      : []
    store.commit('setToc', [...(document.toc || []), ...added])

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
    /** Whether the layout header above already names this page. */
    inModuleHeader: ({ $route }) => isPackageRoot($route.path),

    /** The package's components that render on their own. */
    liveComponents: ({ pkg }) => liveComponentsOf(pkg),
  },
}
</script>
