<template>
  <section
    v-if="open"
    class="fixed bottom-4 inset-x-4 sm:left-auto sm:w-96 z-[60] rounded-box border border-base-300 bg-base-200 text-base-content shadow-lg p-4"
    aria-label="Analytics choice"
  >
    <p class="text-sm leading-relaxed">
      Help us improve the docs? Druxt is a small open source project, and Google Analytics shows
      us where to focus. It sets cookies, so it stays off unless you allow it.
      <NuxtLink class="underline hover:text-primary" to="/privacy">Privacy policy</NuxtLink>
    </p>
    <div class="mt-3 grid grid-cols-2 gap-2">
      <button class="btn btn-sm btn-outline" type="button" @click="choose('granted')">Allow</button>
      <button class="btn btn-sm btn-outline" type="button" @click="choose('denied')">No thanks</button>
    </div>
  </section>
</template>

<script>
import { GA_MEASUREMENT_ID, isOptedOut, readConsent, setConsent } from '~/lib/analytics'

export default {
  data: () => ({ open: false }),

  mounted() {
    // The snippet only exists on the production site, so previews never ask.
    this.open = typeof window.druxtAnalytics === 'function' && !isOptedOut(window) && readConsent(window) === null
    this.$nuxt.$on('consent:open', this.show)
  },

  beforeDestroy() {
    this.$nuxt.$off('consent:open', this.show)
  },

  methods: {
    /** Asks again, from the footer's Cookie settings. */
    show() {
      this.open = true
    },

    /**
     * Records the choice, acts on it and stops asking.
     *
     * @param {string} choice - 'granted' or 'denied'.
     */
    choose(choice) {
      setConsent(window, choice, GA_MEASUREMENT_ID)
      this.open = false
    },
  },
}
</script>
