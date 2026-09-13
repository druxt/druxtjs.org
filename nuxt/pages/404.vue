<template>
  <AppErrorState :status-code="404" />
</template>

<script>
/**
 * The statically served 404.
 *
 * `nuxt generate` emits this as 404/index.html, which nginx serves with a real
 * 404 status for unknown URLs. Visiting /404 directly returns 200, hence the
 * noindex.
 */
export default {
  head() {
    return {
      title: 'Page not found',
      meta: [
        { hid: 'robots', name: 'robots', content: 'noindex, follow' },
      ],
    }
  },
}
</script>
