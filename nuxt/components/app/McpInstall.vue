<template>
  <section aria-label="Connect your client">
    <div class="flex items-center gap-3 rounded-lg border border-base-300 bg-base-200 p-3 pl-4 font-mono text-sm sm:text-base">
      <span class="flex-1 min-w-0 break-all">{{ url }}</span>
      <button class="btn btn-sm btn-outline flex-none min-h-[44px] sm:min-h-0" type="button" @click="copy(url, 'url')">
        {{ copied === 'url' ? 'Copied' : 'Copy' }}
      </button>
    </div>

    <div class="mt-6"></div>
    <div class="flex flex-wrap gap-1 border-b border-base-300" role="tablist" aria-label="AI clients">
      <button
        v-for="(client, index) of clients"
        :key="client.name"
        class="-mb-px min-h-[44px] border-b-2 px-3 py-2 font-semibold"
        :class="index === selected ? 'border-primary-focus text-primary-focus' : 'border-transparent text-base-content/70'"
        type="button"
        role="tab"
        :aria-selected="index === selected ? 'true' : 'false'"
        @click="selected = index"
      >{{ client.name }}</button>
    </div>
    <!-- All rendered, and only one shown. AppProse moves each code block when it
         adds its copy button, so a block Vue swapped would vanish. -->
    <div v-for="(client, index) of clients" v-show="index === selected" :key="client.name" class="pt-4" role="tabpanel">
      <p class="mb-3 text-base-content/70">{{ client.note }}</p>
      <div class="prose max-w-none">
        <DuiCodeBlock :code="client.code" :language="client.language" />
      </div>
      <a v-if="client.install" class="btn btn-primary btn-sm mt-3" :href="client.install">{{ client.action }}</a>
    </div>
  </section>
</template>

<script>
import { SITE_ORIGIN } from '~/lib/site'
import { mcpClients } from '~/lib/mcp-clients'

/** The install tabs for the docs server, and the address they all point at. */
export default {
  data: () => ({ selected: 0, copied: null }),

  computed: {
    url: () => `${SITE_ORIGIN}/mcp`,
    clients: ({ url }) => mcpClients(url),
  },

  methods: {
    /**
     * Copy text, and say so on the button that asked.
     *
     * @param {string} text - The text to copy.
     * @param {string} key - Which button asked.
     */
    async copy(text, key) {
      try {
        await navigator.clipboard.writeText(text)
        this.copied = key
      } catch (e) {
        // A browser can refuse the clipboard. The text is on the page to select.
      }
    },
  },
}
</script>

<style scoped>
/* The page's prose colours every link, which would hide this one's text. */
a.btn {
  color: #fff;
}
</style>
