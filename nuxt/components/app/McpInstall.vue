<template>
  <section aria-label="Connect your client">
    <div class="prose max-w-none">
      <DuiCodeBlock :code="url" language="text" />
    </div>
    <div class="mt-6"></div>
    <div class="flex flex-wrap gap-1 border-b border-base-300" role="tablist" aria-label="AI clients">
      <button
        v-for="(client, index) of clients"
        :id="`mcp-tab-${index}`"
        :key="client.name"
        ref="tabs"
        class="-mb-px min-h-[44px] border-b-2 px-3 py-2 font-semibold"
        :class="index === selected ? 'border-primary-focus text-primary-focus' : 'border-transparent text-base-content/70'"
        type="button"
        role="tab"
        :aria-selected="index === selected ? 'true' : 'false'"
        :aria-controls="`mcp-panel-${index}`"
        :tabindex="index === selected ? 0 : -1"
        @click="selected = index"
        @keydown.left.prevent="move(-1)"
        @keydown.right.prevent="move(1)"
      >{{ client.name }}</button>
    </div>
    <!-- All rendered, and only one shown. AppProse moves each code block when it
         adds its copy button, so a block Vue swapped would vanish. -->
    <div
      v-for="(client, index) of clients"
      v-show="index === selected"
      :id="`mcp-panel-${index}`"
      :key="client.name"
      class="pt-4"
      role="tabpanel"
      :aria-labelledby="`mcp-tab-${index}`"
    >
      <div class="prose max-w-none">
        <p>
          {{ client.note }}
          <a v-if="client.install" :href="client.install">{{ client.action }}</a>
        </p>
        <DuiCodeBlock :code="client.code" :language="client.language" />
      </div>
    </div>
  </section>
</template>

<script>
import { SITE_ORIGIN } from '~/lib/site'
import { mcpClients } from '~/lib/mcp-clients'

/** The install tabs for the docs server, and the address they all point at. */
export default {
  data: () => ({ selected: 0 }),

  computed: {
    url: () => `${SITE_ORIGIN}/mcp`,
    clients: ({ url }) => mcpClients(url),
  },

  methods: {
    /**
     * Move to the next or previous tab, as the arrow keys do in a tab list.
     *
     * @param {number} step - 1 for the next tab, -1 for the previous one.
     */
    move(step) {
      const count = this.clients.length
      this.selected = (this.selected + step + count) % count
      this.$refs.tabs[this.selected].focus()
    },
  },
}
</script>
