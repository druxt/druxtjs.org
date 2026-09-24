<template>
  <!-- Sign in, forgot password and sent, in one place. The dialog and /login both show it. -->
  <div>
    <template v-if="view === 'signin'">
      <h2 class="text-xl font-extrabold tracking-tight mb-1">Sign in to edit</h2>
      <p class="text-xs text-base-content/70 leading-relaxed mb-5">
        <slot name="lead">For druxtjs.org editors and contributors. Reading the docs never needs an account.</slot>
      </p>

      <form class="flex flex-col gap-4" novalidate @submit.prevent="signIn">
        <div class="flex flex-col gap-1.5">
          <label for="sign-in-name" class="text-xs font-semibold">Username or email</label>
          <input
            id="sign-in-name"
            ref="name"
            v-model="name"
            class="sign-in-input"
            type="text"
            name="name"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            required
            :disabled="busy"
          >
        </div>

        <div class="flex flex-col gap-1.5">
          <div class="flex items-baseline justify-between">
            <label for="sign-in-pass" class="text-xs font-semibold">Password</label>
            <button type="button" class="text-xs text-primary-focus hover:underline" :disabled="busy" @click="show('forgot')">Forgot password?</button>
          </div>
          <div class="relative">
            <input
              id="sign-in-pass"
              v-model="pass"
              class="sign-in-input pr-10"
              :class="{ 'sign-in-invalid': error }"
              :type="reveal ? 'text' : 'password'"
              name="pass"
              autocomplete="current-password"
              required
              :disabled="busy"
              :aria-invalid="String(Boolean(error))"
              :aria-describedby="error ? 'sign-in-error' : null"
            >
            <button
              type="button"
              class="absolute inset-y-0 right-0 w-10 grid place-items-center text-base-content/60 hover:text-base-content"
              :aria-label="reveal ? 'Hide password' : 'Show password'"
              :aria-pressed="String(reveal)"
              @click="reveal = !reveal"
            >
              <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
                <path v-if="reveal" d="M4 4l16 16" />
              </svg>
            </button>
          </div>
          <p v-if="error" id="sign-in-error" class="sign-in-error" role="alert">
            <svg class="account-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            {{ error }}
          </p>
        </div>

        <button type="submit" class="sign-in-submit" :disabled="busy || !name || !pass" data-testid="sign-in-submit">
          <span v-if="busy" class="sign-in-spinner" aria-hidden="true" />
          {{ busy ? 'Signing in…' : 'Sign in' }}
        </button>
      </form>
    </template>

    <template v-else-if="view === 'forgot'">
      <button type="button" class="flex items-center gap-1 text-xs text-primary-focus hover:underline mb-3" @click="show('signin')">
        <svg class="account-icon !w-3.5 !h-3.5 !text-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
        Back to sign in
      </button>
      <h2 class="text-xl font-extrabold tracking-tight mb-1">Reset your password</h2>
      <p class="text-xs text-base-content/70 leading-relaxed mb-5">We'll email you a link to choose a new one.</p>

      <form class="flex flex-col gap-4" novalidate @submit.prevent="reset">
        <div class="flex flex-col gap-1.5">
          <label for="sign-in-mail" class="text-xs font-semibold">Email</label>
          <input
            id="sign-in-mail"
            ref="mail"
            v-model="mail"
            class="sign-in-input"
            :class="{ 'sign-in-invalid': error }"
            type="email"
            name="mail"
            autocomplete="email"
            required
            :disabled="busy"
          >
          <p v-if="error" class="sign-in-error" role="alert">{{ error }}</p>
        </div>
        <button type="submit" class="sign-in-submit" :disabled="busy || !mail">
          <span v-if="busy" class="sign-in-spinner" aria-hidden="true" />
          {{ busy ? 'Sending…' : 'Send reset link' }}
        </button>
      </form>
    </template>

    <template v-else>
      <div class="w-9 h-9 rounded-full grid place-items-center avatar-hue-1 mb-3.5">
        <svg class="account-icon !text-current" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
      </div>
      <h2 class="text-xl font-extrabold tracking-tight mb-1.5">Check your email</h2>
      <p class="text-xs text-base-content/70 leading-relaxed mb-5">
        If <strong class="text-base-content">{{ mail }}</strong> has an account, a reset link is on its way. It works once and expires in 24 hours.
      </p>
      <button type="button" class="w-full h-9 rounded-lg border border-base-300 text-sm font-medium hover:border-primary" @click="show('signin')">Back to sign in</button>
    </template>
  </div>
</template>

<script>
import { AUTH_STRATEGY, SCOPES } from '~/lib/auth'
import { signInError } from '~/lib/account'

/**
 * The site's own sign-in form.
 *
 * druxt-auth's Drupal scheme signs in through Drupal's JSON login, on this
 * origin, then runs the authorization code flow, which the consumer approves
 * without showing anything. The editor comes back to `destination`.
 */
export default {
  props: {
    /** Where to return after signing in. Defaults to the current page. */
    destination: { type: String, default: null },
  },

  data: () => ({
    view: 'signin',
    name: '',
    pass: '',
    mail: '',
    reveal: false,
    busy: false,
    error: null,
  }),

  mounted() {
    this.focus()
  },

  methods: {
    show(view) {
      this.view = view
      this.error = null
      this.focus()
    },

    focus() {
      this.$nextTick(() => {
        const field = this.view === 'forgot' ? this.$refs.mail : this.$refs.name
        if (field) field.focus()
      })
    },

    strategy() {
      return this.$auth.strategies[AUTH_STRATEGY]
    },

    async signIn() {
      this.busy = true
      this.error = null
      try {
        this.$auth.$storage.setUniversal('redirect', this.destination || this.$route.fullPath)
        // The password grant: the site's own server exchanges these for a
        // token. No redirect, so this does return, and the reader is sent on
        // from here rather than by a callback.
        await this.$auth.loginWith(AUTH_STRATEGY, {
          data: {
            grant_type: 'password',
            username: this.name.trim(),
            password: this.pass,
            scope: SCOPES.join(' '),
          },
        })
        this.$router.push(this.destination || this.$route.fullPath)
      } catch (error) {
        // A session already open is refused by the scheme rather than reused,
        // so it arrives as an error of its own with nothing from Drupal on it.
        const { status, data } = error.response || {}
        this.error = error.sessionInUse ? error.message : signInError(status, (data || {}).message)
        this.busy = false
      }
    },

    async reset() {
      this.busy = true
      this.error = null
      try {
        await this.strategy().resetPassword(this.mail.trim())
        this.view = 'sent'
      } catch (error) {
        const { status, data } = error.response || {}
        this.error = status >= 500 || !status ? signInError(status) : (data || {}).message || 'Enter a valid email address.'
      } finally {
        this.busy = false
      }
    },
  },
}
</script>
