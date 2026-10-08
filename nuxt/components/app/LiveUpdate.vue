<template>
  <!-- Polite and out of the way: the reader chooses when the page changes. -->
  <div class="live-update" role="status" aria-live="polite" data-testid="live-update">
    <transition name="live-update">
      <div v-if="shown" class="live-update-card">
        <p class="live-update-text">{{ failed ? 'The update did not load.' : 'This page has changed since you opened it.' }}</p>
        <button type="button" class="btn btn-primary btn-sm" :disabled="loading" data-testid="live-update-show" @click="show">
          {{ loading ? 'Loading…' : failed ? 'Try again' : 'Show the update' }}
        </button>
        <button type="button" class="btn btn-ghost btn-sm btn-square" aria-label="Dismiss" @click="dismiss">
          <svg viewBox="0 0 24 24" class="h-4 w-4" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </div>
    </transition>
  </div>
</template>

<script>
/** How long a refresh asks past the browser's cache, as in the plugin. */
const FRESH_FOR = 15000

/**
 * Says when Drupal has changed what the page shows, from plugins/live-updates.
 * Loading the change clears Druxt's stores and runs the page's data again, so
 * the header, the body and the menus all follow.
 */
export default {
  name: 'AppLiveUpdate',

  data: () => ({ dismissedAt: 0, loading: false, failed: false }),

  computed: {
    changedAt: ({ $liveUpdates }) => ($liveUpdates || {}).changedAt || 0,
    shown: ({ changedAt, dismissedAt }) => changedAt > dismissedAt,
  },

  watch: {
    // A new page is loaded fresh: an earlier notice no longer applies.
    '$route.path'() {
      this.dismissedAt = Date.now()
    },
  },

  methods: {
    dismiss() {
      this.dismissedAt = Date.now()
    },

    // The notice stays, with a retry, when the refresh fails: the page is still out of date.
    async show() {
      this.loading = true
      try {
        this.$liveUpdates.freshUntil = Date.now() + FRESH_FOR
        await this.$store.dispatch('druxt/clearCache')
        await this.$nuxt.refresh()
        this.failed = false
        this.dismissedAt = Date.now()
      } catch (error) {
        this.failed = true
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.live-update {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 40;
  max-width: calc(100vw - 2rem);
}
.live-update-card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  border: 1px solid hsl(var(--b3));
  border-radius: 0.75rem;
  background: hsl(var(--b1));
  box-shadow: 0 10px 25px -10px rgb(0 0 0 / 0.3);
}
.live-update-text {
  margin: 0;
  font-size: 0.875rem;
}
.live-update-enter-active,
.live-update-leave-active {
  transition: opacity var(--motion-base) var(--motion-ease-out), transform var(--motion-base) var(--motion-ease-out);
}
.live-update-enter,
.live-update-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}
@media (max-width: 30rem) {
  .live-update {
    left: 1rem;
  }
  .live-update-text {
    flex: 1;
  }
}
</style>
