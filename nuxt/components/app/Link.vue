<template>
  <component :is="external ? 'a' : 'NuxtLink'" v-bind="external ? { href: to, target: '_blank', rel: 'noopener' } : { to }">
    <slot />
  </component>
</template>

<script>
import { isExternal } from '~/utils/link'

/**
 * A link to wherever an editor points it: a page of the site through the
 * router, and anything else as a plain link in a new tab.
 */
export default {
  props: {
    to: { type: String, required: true },
  },
  computed: {
    external: ({ to }) => isExternal(to),
  },
}
</script>
