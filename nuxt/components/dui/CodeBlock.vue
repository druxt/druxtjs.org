<template>
  <pre :class="`language-${language}`"><code :class="`language-${language}`" v-html="highlighted" /></pre>
</template>

<script>
import { highlight } from '~/utils/highlight'

/** A highlighted code block. */
export default {
  props: {
    code: { type: String, required: true },
    language: { type: String, default: 'text' },
  },
  computed: {
    highlighted: ({ code, language }) => highlight(code, language),
  },
}
</script>
