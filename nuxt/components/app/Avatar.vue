<template>
  <!-- The Drupal picture, or initials on one of the three brand tints. -->
  <span
    class="avatar-disc relative inline-grid place-items-center flex-shrink-0 rounded-full overflow-hidden font-semibold select-none"
    :class="[`avatar-hue-${account.hue}`, sizeClass]"
    aria-hidden="true"
  >
    <img v-if="account.picture && !broken" :src="account.picture" alt="" class="w-full h-full object-cover" @error="broken = true">
    <template v-else>{{ account.initials }}</template>
  </span>
</template>

<script>
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

  data: () => ({ broken: false }),

  computed: {
    sizeClass: ({ size }) => SIZES[size] || SIZES[28],
  },

  watch: {
    'account.picture'() {
      this.broken = false
    },
  },
}
</script>
