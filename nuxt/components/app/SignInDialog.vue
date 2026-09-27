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
      @touchmove.self.prevent
      @keydown.esc.prevent="close"
      @keydown.tab="onTab"
    >
      <div class="sign-in-sheet relative w-full sm:max-w-[380px] bg-base-100 border border-base-300 rounded-t-2xl sm:rounded-2xl shadow-2xl px-5 pt-3 sm:p-6">
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
  data: () => ({ restoreFocusTo: null, scrollY: 0 }),

  computed: {
    open: ({ $store }) => $store.state.signIn,
  },

  watch: {
    open(open) {
      if (open) {
        this.restoreFocusTo = document.activeElement
        this.lockPage()
        return
      }
      this.unlockPage()
      if (this.restoreFocusTo && this.restoreFocusTo.focus) this.restoreFocusTo.focus()
    },
  },

  beforeDestroy() {
    if (this.open) this.unlockPage()
  },

  methods: {
    close() {
      this.$store.commit('setSignIn', false)
    },

    // The page behind the sheet neither scrolls nor pans under the keyboard:
    // the body is pinned at its scroll position (see .sign-in-open in app.css)
    // and put back on close. On a phone the keyboard shrinks only the visual
    // viewport, so the overlay is sized to that rather than to the layout
    // viewport, which keeps the sheet above the keyboard with nothing of the
    // page reachable around it.
    lockPage() {
      this.scrollY = window.scrollY
      document.body.style.top = `-${this.scrollY}px`
      document.documentElement.classList.add('sign-in-open')
      const viewport = window.visualViewport
      if (viewport) {
        viewport.addEventListener('resize', this.fitViewport)
        viewport.addEventListener('scroll', this.fitViewport)
      }
      this.$nextTick(this.fitViewport)
    },

    unlockPage() {
      const viewport = window.visualViewport
      if (viewport) {
        viewport.removeEventListener('resize', this.fitViewport)
        viewport.removeEventListener('scroll', this.fitViewport)
      }
      document.documentElement.classList.remove('sign-in-open')
      document.body.style.top = ''
      window.scrollTo(0, this.scrollY)
    },

    fitViewport() {
      const dialog = this.$refs.dialog
      const viewport = window.visualViewport
      if (!dialog || !viewport) return
      dialog.style.top = `${viewport.offsetTop}px`
      dialog.style.height = `${viewport.height}px`
    },

    onTab(event) {
      trapTab(this.$refs.dialog, event)
    },
  },
}
</script>
