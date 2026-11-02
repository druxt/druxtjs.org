<template>
  <article>
    <AppPageHeader :title="title" :description="description" />
    <AppMcpInstall />
    <!-- The rest of the page is authored in Drupal, at the alias /mcp. -->
    <AppProse v-if="document" :key="document.path" class="mt-8" :title="title">
      <DruxtEntity :key="document.uuid" :type="document.type" :uuid="document.uuid" mode="full" />
    </AppProse>
  </article>
</template>

<script>
import { MCP_DESCRIPTION, MCP_TITLE } from '~/lib/site'
import { fetchDrupalPage } from '~/lib/drupal-document'
import { seoHead } from '~/utils/seo'

export default {
  name: 'McpPage',
  async asyncData({ store }) {
    const document = await fetchDrupalPage(store, '/mcp').catch(() => null)
    if (document) store.commit('setToc', document.toc)
    return { document }
  },
  data: () => ({ title: MCP_TITLE, description: MCP_DESCRIPTION }),
  head() {
    return seoHead({ title: MCP_TITLE, description: MCP_DESCRIPTION, path: '/mcp', type: 'website' })
  },
}
</script>
