<template>
  <!-- plugins/mermaid.client.js replaces this with the rendered figure. -->
  <pre><code class="language-mermaid">{{ source }}</code></pre>
</template>

<script>
/** A mermaid diagram, from its source. A first line of `%% text` captions it. */
export default {
  props: {
    source: { type: String, required: true },
  },
  // A diagram that mounts after the page's own pass, such as one inside a live
  // example, asks for another; the plugin listens for this.
  mounted() {
    window.dispatchEvent(new Event('docs:content'))
  },
}
</script>
