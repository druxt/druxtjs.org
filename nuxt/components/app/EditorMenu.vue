<template>
  <!-- Rendered only where the auth module is loaded: Storybook has no $auth. -->
  <div v-if="$auth" class="flex items-center">
    <div v-if="$auth.loggedIn" class="dropdown dropdown-end">
      <button type="button" tabindex="0" class="btn btn-ghost btn-sm normal-case font-normal max-w-[10rem]" :title="name">
        <span class="truncate">{{ name }}</span>
      </button>

      <ul tabindex="0" class="dropdown-content menu mt-2 p-1 shadow-lg bg-base-100 border border-base-300 rounded-box w-40">
        <li>
          <button type="button" class="rounded-btn px-3 py-2 text-sm" @click="$signOut()">Sign out</button>
        </li>
      </ul>
    </div>

    <button v-else type="button" class="btn btn-ghost btn-sm normal-case font-normal" @click="$auth.loginWith(strategy)">
      Sign in
    </button>
  </div>
</template>

<script>
import { AUTH_STRATEGY } from '~/lib/auth'

export default {
  data: () => ({ strategy: AUTH_STRATEGY }),

  computed: {
    /** The signed-in editor, as Drupal's userinfo names them. */
    name: ({ $auth }) => ($auth.user && ($auth.user.name || $auth.user.email)) || 'Signed in',
  },
}
</script>
