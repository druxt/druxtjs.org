<template>
  <component
    :is="external ? 'a' : 'NuxtLink'"
    v-bind="external ? { href: to, target: '_blank', rel: 'noopener' } : { to }"
    class="page-card group flex gap-4 rounded-box border border-base-300 no-underline hover:border-primary transition-colors"
    :class="large ? 'p-5 bg-base-200 border-primary' : 'p-4'"
  >
    <span v-if="step" class="page-card-step shrink-0 grid place-items-center w-8 h-8 rounded-btn bg-base-200 text-primary-focus font-mono text-xs font-bold" aria-hidden="true" />
    <span class="flex flex-col min-w-0 flex-1">
      <span v-if="eyebrow" class="block text-xs uppercase tracking-wider text-base-content/70" v-text="eyebrow" />
      <span class="block font-medium group-hover:text-primary-focus" :class="large && 'text-lg mt-0.5'">
        {{ title }}<span v-if="external" class="ml-1 text-base-content/60" aria-hidden="true">&nearr;</span>
      </span>
      <span v-if="description" class="block mt-1 text-sm text-base-content/70" v-text="description" />
    </span>
    <span v-if="arrow" class="self-center text-base-content/50 group-hover:text-primary-focus group-hover:translate-x-0.5 transition-transform" :class="large && 'text-2xl'" aria-hidden="true">&rarr;</span>
  </component>
</template>

<script>
/**
 * A page, as a card: its title, its description, and a way to it.
 *
 * The one card the site draws a page with wherever pages are listed: a
 * section landing's teaser and step view modes, and a page's next steps.
 * A step counts itself with a CSS counter the list around it keeps, and a
 * link off the site opens in a new tab, since the router cannot take it.
 */
export default {
  props: {
    title: { type: String, required: true },
    description: { type: String, default: '' },
    to: { type: String, required: true },
    /** A small label above the title: "Next". */
    eyebrow: { type: String, default: '' },
    /** The large, tinted card a page's "Next" gets. */
    large: { type: Boolean, default: false },
    /** A numbered step in a sequence. */
    step: { type: Boolean, default: false },
    /** An arrow at the end. */
    arrow: { type: Boolean, default: false },
  },
  computed: {
    external: ({ to }) => /^[a-z][a-z0-9+.-]*:/i.test(to),
  },
}
</script>
