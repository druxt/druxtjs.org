<template>
  <AppErrorState :status-code="statusCode" />
</template>

<script>
/**
 * Error page.
 *
 * Exists for the `noindex` below: Nuxt's built-in error page carries no robots
 * directive. The body lives in components/app/ErrorState.vue, shared with
 * pages/404.vue.
 */
export default {
  props: {
    error: { type: Object, default: () => ({}) },
  },

  head() {
    return {
      title: this.statusCode === 404 ? 'Page not found' : 'Something went wrong',
      meta: [
        { hid: 'robots', name: 'robots', content: 'noindex, follow' },
      ],
    }
  },

  computed: {
    statusCode: ({ error }) => error.statusCode || 404,
  },
}
</script>
