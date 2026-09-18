<template>
  <!-- OAuth returns here with a code. The auth scheme exchanges it on mount and sends the editor on. -->
  <div class="py-16 text-center">
    <p v-if="hasCode" class="text-base-content/70">Signing you in…</p>
    <p v-else class="text-base-content/70">
      Nothing to sign in with.
      <NuxtLink to="/" class="link link-primary">Back to the site</NuxtLink>
    </p>
  </div>
</template>

<script>
export default {
  middleware: ['auth'],

  head: () => ({
    title: 'Signing in',
    meta: [{ hid: 'robots', name: 'robots', content: 'noindex' }],
  }),

  computed: {
    hasCode: ({ $route }) => Boolean($route.query.code),
  },
}
</script>
