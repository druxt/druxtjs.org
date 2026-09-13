<template>
  <AppMenu v-if="variant === 'horizontal'" :menu="menu" horizontal :home="false" :external="false" :icons="false" />
  <AppMenu v-else :menu="menu" :children="true">
    <li slot="title" class="menu-title px-3 pb-1">
      <span class="text-xs font-semibold uppercase tracking-wider text-base-content/70">Navigation</span>
    </li>
  </AppMenu>
</template>

<script>
import { mergeSiteMenu } from '~/utils/menu'

/** The docs menu, from Drupal, as a row (header) or a tree (sidebar). */
export default {
  props: {
    items: { type: Array, default: () => [] },
    variant: { type: String, default: 'sidebar' },
  },
  computed: {
    menu: ({ items, $store }) => mergeSiteMenu(items, $store.state.menu),
  },
}
</script>
