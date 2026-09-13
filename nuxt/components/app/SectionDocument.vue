<template>
  <article>
    <AppPageHeader :title="document.title" :description="document.description" />
    <AppProse v-if="!drupal" :document="document" />
    <!-- Keyed so each page gets a fresh AppProse, whose enhance() runs on mount. -->
    <AppProse v-else :key="document.path" :title="document.title">
      <DruxtEntity :type="document.type" :uuid="document.uuid" mode="full" />
    </AppProse>
    <AppDocFooter :prev="prev" :next="next" />
  </article>
</template>

<script>
import { seoHead } from '~/utils/seo'
import { documentDescription } from '~/utils/content'
import { fetchDrupalPage, sectionOf } from '~/lib/drupal-document'

/** Pages docgen writes into the authored sections; they come from its corpus, not Drupal. */
const GENERATED = ['/how-to/contributing']

/**
 * A page in one of the authored sections: tutorials, how-to or explanation.
 *
 * Read from Drupal and rendered by DruxtEntity, or read from the markdown when
 * DOCS_SOURCE is "markdown". Each section's `_.vue` extends this.
 */
export default {
  name: 'AppSectionDocument',
  async asyncData({ $config, $content, error, params, redirect, store, route }) {
    const section = sectionOf(route.path)
    const path = route.path.replace(/\/$/, '') || '/'

    if ($config.docsSource !== 'markdown' && !GENERATED.includes(path)) {
      const document = await fetchDrupalPage(store, path)
      if (!document) return error({ statusCode: 404, message: 'Document not found' })
      // Drupal matches aliases in any case; one spelling is the page.
      if (document.redirect) return redirect(301, document.redirect, route.query)
      // Siblings in the docs menu's order, the section landing first.
      const top = store.state.menu.find((item) => (item.props || {}).to === `/${section}`)
      // Drupal's menu also lists the landing among its own children; keep it once.
      const siblings = top
        ? [top, ...(top.children || [])]
            .map((item) => ({ text: item.text, to: item.props.to }))
            .filter((item, index, all) => all.findIndex((o) => o.to === item.to) === index)
        : []
      store.commit('addRecent', { text: document.title, to: route.path })
      store.commit('setToc', document.toc)
      return { document, drupal: true, section, siblings, current: path }
    }

    const slug = params.pathMatch || 'README'
    let document
    try {
      document = await $content(`${section}/`, slug).fetch()
    } catch (e) {
      return error({ statusCode: 404, message: 'Document not found' })
    }
    const index = await $content(section).sortBy('weight').only(['path', 'title']).fetch()
    const to = (item) => item.path.replace('/README', '')
    store.commit('addRecent', { text: document.title, to: route.path })
    store.commit('setToc', document.toc || [])
    return {
      document,
      drupal: false,
      section,
      siblings: index.map((item) => ({ text: item.title, to: to(item) })),
      current: to(document),
    }
  },
  head() {
    return seoHead({
      title: this.document.title,
      description: this.drupal ? this.document.description : documentDescription(this.document),
      path: this.$route.path,
    })
  },
  computed: {
    position: ({ siblings, current }) => siblings.findIndex((o) => o.to === current),
    prev: ({ siblings, position }) => (position > 0 ? siblings[position - 1] : null),
    next: ({ siblings, position }) => (position > -1 && position < siblings.length - 1 ? siblings[position + 1] : null),
  },
}
</script>
