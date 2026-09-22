<template>
  <!-- A dialog over the dimmed page, and a bottom sheet on a phone. -->
  <transition name="fade">
    <div
      v-if="open"
      ref="dialog"
      class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-neutral/50 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      @click.self="close"
      @keydown.esc.prevent="close"
      @keydown.tab="onTab"
    >
      <div class="relative w-full sm:max-w-[380px] bg-base-100 border border-base-300 rounded-t-2xl sm:rounded-2xl shadow-2xl px-5 pt-3 pb-6 sm:p-6">
        <div class="sm:hidden w-9 h-1 rounded bg-base-300 mx-auto mb-4" aria-hidden="true" />
        <div class="hidden sm:flex items-center justify-between mb-4">
          <AppLogo class="h-6 w-auto" />
          <button type="button" class="w-7 h-7 grid place-items-center rounded-md text-base-content/60 hover:text-base-content hover:bg-base-200" aria-label="Close" @click="close">
            <svg class="account-icon !text-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <AppSignInForm />
      </div>
    </div>
  </transition>
</template>

<script>
import { trapTab } from '~/utils/focus'

export default {
  data: () => ({ restoreFocusTo: null }),

  computed: {
    open: ({ $store }) => $store.state.signIn,
  },

  watch: {
    open(open) {
      if (open) {
        this.restoreFocusTo = document.activeElement
        return
      }
      if (this.restoreFocusTo && this.restoreFocusTo.focus) this.restoreFocusTo.focus()
    },
  },

  methods: {
    close() {
      this.$store.commit('setSignIn', false)
    },

    onTab(event) {
      trapTab(this.$refs.dialog, event)
    },
  },
}
</script>
