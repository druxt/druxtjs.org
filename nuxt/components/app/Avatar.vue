<template>
  <!-- The Drupal picture, or initials on one of the three brand tints. -->
  <span
    class="avatar-disc relative inline-grid place-items-center flex-shrink-0 rounded-full overflow-hidden font-semibold select-none"
    :class="[`avatar-hue-${account.hue}`, sizeClass]"
    aria-hidden="true"
  >
    <img v-if="src && !broken" :src="src" alt="" class="w-full h-full object-cover" @error="onError">
    <template v-else>{{ account.initials }}</template>
  </span>
</template>

<script>
import { emailHash, gravatarUrl } from '~/lib/gravatar'

const SIZES = {
  24: 'w-6 h-6 text-[10px]',
  28: 'w-7 h-7 text-[11px]',
  40: 'w-10 h-10 text-sm',
  64: 'w-16 h-16 text-xl',
}

export default {
  props: {
    /** An account from lib/account's accountOf(). */
    account: { type: Object, required: true },
    size: { type: Number, default: 28 },
  },

  data: () => ({ broken: false, gravatar: null }),

  computed: {
    sizeClass: ({ size }) => SIZES[size] || SIZES[28],
    /** Drupal's picture, else Gravatar's, else the initials below. */
    src: ({ account, gravatar }) => account.picture || gravatar,
  },

  watch: {
    'account.picture': 'reset',
    'account.email': 'reset',
  },

  mounted() {
    this.reset()
  },

  methods: {
    /** A Gravatar 404 means the address has none: the initials stand in. */
    onError() {
      if (this.src === this.gravatar) this.gravatar = null
      else this.broken = true
    },

    async reset() {
      this.broken = false
      this.gravatar = null
      if (this.account.picture || !this.account.email) return
      const hash = await emailHash(this.account.email)
      if (hash) this.gravatar = gravatarUrl(hash, this.size * 2)
    },
  },
}
</script>
