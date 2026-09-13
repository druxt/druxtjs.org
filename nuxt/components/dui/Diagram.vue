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
}
</script>
