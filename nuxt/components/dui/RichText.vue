<template>
  <div v-html="rendered" />
</template>

<script>
const HEADING = /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g

const text = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim()

/**
 * Formatted HTML. Given `headingId`, each heading gets that id and an anchor,
 * the markup the table of contents scroll-spies against.
 */
export default {
  props: {
    html: { type: String, required: true },
    headingId: { type: Function, default: null },
  },
  computed: {
    rendered() {
      if (!this.headingId) return this.html
      return this.html.replace(HEADING, (match, depth, attributes, inner) => {
        const id = this.headingId(text(inner))
        return `<h${depth}${attributes} id="${id}"><a href="#${id}" aria-hidden="true" tabindex="-1"><span class="icon icon-link"></span></a>${inner}</h${depth}>`
      })
    },
  },
}
</script>
