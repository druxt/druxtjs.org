<template>
  <div :data-druxt-entity="(entity || {}).id || false" :data-druxt-type="(entity || {}).type" class="not-prose my-6">
    <AppMcpInstall />
  </div>
</template>

<script>
/** The MCP server's address and setup tabs, where the editor put them in the page. */
export default {
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
  },
}
</script>
