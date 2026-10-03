<template>
  <!-- Rendered only where the auth module is loaded: Storybook has no $auth. -->
  <div v-if="$auth" class="flex items-center">
    <div v-if="$auth.loggedIn" class="dropdown dropdown-end">
      <button
        type="button"
        tabindex="0"
        class="flex items-center p-0.5 rounded-full hover:ring-2 hover:ring-base-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :aria-label="`Account: ${account.name}`"
        data-testid="account-menu"
      >
        <AppAvatar :account="account" :size="28" />
      </button>

      <div tabindex="0" class="dropdown-content mt-2 w-64 p-1.5 bg-base-100 border border-base-300 rounded-xl shadow-lg text-sm">
        <div class="flex items-center gap-3 px-2.5 pt-2.5 pb-3">
          <AppAvatar :account="account" :size="40" />
          <div class="min-w-0">
            <div class="font-semibold truncate" v-text="account.name" />
            <div class="flex items-center gap-1.5 text-xs text-base-content/70">
              <span v-if="account.username" class="truncate">@{{ account.username }}</span>
              <span
                v-if="account.role"
                class="flex-shrink-0 px-1.5 rounded-full border border-base-300 text-[10.5px] font-semibold uppercase tracking-wide text-primary-focus"
                v-text="account.role"
              />
            </div>
          </div>
        </div>

        <div class="h-px bg-base-300 -mx-1.5 my-1.5" />

        <!-- Drupal's own screens, on this origin through the proxy. -->
        <a href="/admin/content/moderated" class="account-item" target="_self">
          <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6v18h12V7z" /><path d="M14 3v4h4" /><path d="M9 13h6M9 17h4" /></svg>
          Your drafts
        </a>
        <a v-if="account.id" :href="`/user/${account.id}/edit`" class="account-item" target="_self">
          <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
          Profile and picture
        </a>

        <div class="h-px bg-base-300 -mx-1.5 my-1.5" />

        <div class="account-item cursor-default hover:bg-transparent">
          <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>
          Theme
          <div class="ml-auto flex border border-base-300 rounded-lg overflow-hidden" role="group" aria-label="Colour mode">
            <button
              v-for="option of themes"
              :key="option.value"
              type="button"
              class="grid place-items-center w-7 h-6 border-l first:border-l-0 border-base-300"
              :class="$colorMode.preference === option.value ? 'bg-base-200 text-primary-focus' : 'text-base-content/70 hover:text-base-content'"
              :title="option.label"
              :aria-pressed="String($colorMode.preference === option.value)"
              @click="$colorMode.preference = option.value"
            >
              <component :is="option.icon" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div class="h-px bg-base-300 -mx-1.5 my-1.5" />

        <button type="button" class="account-item w-full" data-testid="account-sign-out" @click="$signOut()">
          <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
          Sign out
        </button>
      </div>
    </div>

    <button
      v-else
      type="button"
      class="h-8 px-3 flex-shrink-0 whitespace-nowrap rounded-lg border border-base-300 text-sm font-medium hover:border-primary hover:text-primary-focus transition-colors"
      data-testid="sign-in"
      @click="$store.commit('setSignIn', true)"
    >
      Sign in
    </button>
  </div>
</template>

<script>
import { accountOf } from '~/lib/account'

export default {
  data: () => ({
    themes: [
      { value: 'system', label: 'System', icon: 'app-icon-menu' },
      { value: 'light', label: 'Light', icon: 'app-icon-sun' },
      { value: 'dark', label: 'Dark', icon: 'app-icon-moon' },
    ],
  }),

  computed: {
    account: ({ $auth }) => accountOf($auth && $auth.user),
  },
}
</script>
