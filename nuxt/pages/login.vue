<template>
  <!-- Where an expired session, a deep link or the auth middleware lands. -->
  <div class="min-h-[70vh] grid place-items-center bg-base-200 px-4 py-12">
    <div class="w-full max-w-[360px] bg-base-100 border border-base-300 rounded-2xl shadow-sm p-6">
      <AppSignInForm :destination="destination">
        <template v-if="$route.query.destination" #lead>Sign in to go back to where you were.</template>
      </AppSignInForm>
    </div>
  </div>
</template>

<script>
export default {
  layout: 'default',

  head: () => ({
    title: 'Sign in',
    meta: [{ hid: 'robots', name: 'robots', content: 'noindex' }],
  }),

  computed: {
    /** A path on this site only, or home. */
    destination: ({ $route, $auth }) => {
      const wanted = String($route.query.destination || ($auth && $auth.$storage.getUniversal('redirect')) || '/')
      return wanted.startsWith('/') && !wanted.startsWith('//') ? wanted : '/'
    },
  },
}
</script>
