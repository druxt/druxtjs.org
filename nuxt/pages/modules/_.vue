<template>
  <div>
    <!-- On the module's own route the layout header already names it. -->
    <AppPageHeader v-if="document && !inModuleHeader" :title="document.title" :description="document.description" :entity="operationsEntity" />

    <!-- Every module README opens with a screenshot; it becomes the hero. -->
    <AppFigure v-if="hero" :src="hero.src" :alt="hero.alt" class="mb-8" />

    <AppProse v-if="document && !drupal" :document="document" />
    <!-- A page authored in Drupal, such as a module's deprecations. -->
    <AppProse v-else-if="document" :key="document.path" :title="document.title">
      <DruxtEntity :key="druxtKey" :type="document.type" :uuid="document.uuid" mode="full" />
    </AppProse>

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
import { fetchDrupalPage } from '~/lib/drupal-document'
import drupalPage, { readEditorQuery } from '~/mixins/drupal-page'

export default {
  name: 'AppModuleDocument',

  mixins: [drupalPage],

  // Supplied by pages/modules.vue via <NuxtChild>.
  props: {
    pkg: { type: String, default: null },
  },

  async asyncData({ $config, $content, error, params, redirect, store, route }) {
    // Trim the trailing slash, so `/modules/entity/` resolves like `/modules/entity`.
    const match = (params.pathMatch || '').replace(/\/+$/, '')

    // A module's README is docgen's; a page under it, such as its
    // deprecations, was authored, and lives in Drupal with the other docs.
    // One Drupal does not hold yet falls back to the markdown.
    if ($config.docsSource !== 'markdown' && match.includes('/')) {
      readEditorQuery(store, route)
      const path = `/modules/${match}`
      const document = await fetchDrupalPage(store, path)
      if (document) {
        // Drupal matches aliases in any case; one spelling is the page.
        if (document.redirect) return redirect(301, document.redirect, route.query)
        store.commit('addRecent', { text: document.title, to: route.path })
        store.commit('setToc', document.toc)
        return { document, drupal: true, hero: null, slug: match }
      }
    }
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

    return { document: { ...document, body }, drupal: false, hero, slug }
  },

  head() {
    return seoHead({
      title: this.document.title,
      description: this.drupal ? this.document.description : documentDescription(this.document),
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
