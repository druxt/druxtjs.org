<template>
  <!-- The advanced panel rewrites this command for the chosen starter kit and runner. -->
  <div class="mt-8 w-full max-w-2xl mx-auto">
    <div class="flex items-center gap-2 rounded-btn bg-base-100 border border-base-300 px-4 py-2 text-left">
      <code class="flex-1 min-w-0 overflow-x-auto text-sm font-mono whitespace-nowrap">{{ command }}</code>
      <button
        type="button"
        class="btn btn-xs btn-ghost flex-shrink-0"
        :aria-label="'Copy ' + command"
        @click="copy"
      >{{ copyLabel }}</button>
    </div>

    <button
      type="button"
      class="mt-2 inline-flex items-center gap-1.5 text-sm text-base-content/70 hover:text-base-content"
      :aria-expanded="advanced ? 'true' : 'false'"
      aria-controls="quickstart-advanced"
      @click="advanced = !advanced"
    >
      <span aria-hidden="true" class="inline-block w-3 text-center">{{ advanced ? '−' : '+' }}</span>
      Advanced
    </button>

    <div
      v-show="advanced"
      id="quickstart-advanced"
      class="mt-3 rounded-box border border-base-300 bg-base-100 p-4 text-left flex flex-col gap-4"
    >
      <!-- Hidden while only one starter kit is enabled. -->
      <fieldset v-if="kits.length > 1">
        <legend class="text-xs font-semibold uppercase tracking-wider text-base-content/70 mb-2">Starter kit</legend>
        <div class="grid gap-2 sm:grid-cols-2">
          <label
            v-for="option of kits"
            :key="option.repo"
            class="flex gap-3 items-start rounded-btn border p-3 cursor-pointer transition-colors"
            :class="repo === option.repo ? 'border-primary bg-base-200' : 'border-base-300 hover:border-primary'"
          >
            <!-- Tailwind 2 spells this `flex-shrink-0`; `shrink-0` generates nothing. -->
            <input
              v-model="repo"
              type="radio"
              name="quickstart"
              class="radio radio-sm radio-primary mt-0.5 flex-shrink-0"
              :value="option.repo"
            >
            <span class="min-w-0">
              <span class="block text-sm font-medium">{{ option.title }}</span>
              <span class="block text-xs text-base-content/70">{{ option.description }}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset v-if="runners.length > 1">
        <legend class="text-xs font-semibold uppercase tracking-wider text-base-content/70 mb-2">Run with</legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="option of runners"
            :key="option.value"
            class="flex items-center gap-2 rounded-btn border px-3 py-2 cursor-pointer text-sm transition-colors"
            :class="runner === option.value ? 'border-primary bg-base-200 font-medium' : 'border-base-300 hover:border-primary'"
          >
            <input v-model="runner" type="radio" name="runner" class="radio radio-sm radio-primary flex-shrink-0" :value="option.value">
            {{ option.label }}
          </label>
        </div>
      </fieldset>

      <p class="text-xs text-base-content/70">
        Every quickstart is a template repository with Drupal and Nuxt in one tree.
        <a :href="'https://github.com/druxt/' + repo" target="_blank" rel="noopener">View {{ repo }} on GitHub</a>.
      </p>
    </div>
  </div>
</template>

<script>
/** The parts of a line an editor writes as "one | two | three". */
const parts = (line) => String(line).split('|').map((part) => part.trim())

/**
 * The front page's quickstart command, with a panel that rewrites it for the
 * chosen starter kit and runner.
 *
 * An editor sets both lists, a line each: a command is its label and the
 * command, where `{repo}` stands for the chosen starter kit, and a starter kit
 * is its repository under github.com/druxt, its title and its description.
 */
export default {
  props: {
    commands: {
      type: Array,
      default: () => [
        'giget | npx giget@1 gh:druxt/{repo}#develop my-druxt-site --install',
        'DevPod | devpod up github.com/druxt/{repo}',
      ],
    },
    starterKits: {
      type: Array,
      default: () => ['quickstart | Druxt Quickstart | Drupal 11, Nuxt 2 and Druxt in one repository.'],
    },
  },

  data: () => ({
    advanced: false,
    copied: false,
    copyFailed: false,
    // The chosen starter kit's repository and the chosen command's place in
    // the list; the first of each until the reader picks.
    picked: null,
    runner: 0,
  }),

  computed: {
    // The commands a reader can run with: a label and a command each.
    runners: ({ commands }) =>
      commands
        .map(parts)
        .filter(([label, command]) => label && command)
        .map(([label, command], value) => ({ value, label, command })),

    // The starter kits currently offered.
    kits: ({ starterKits }) =>
      starterKits
        .map(parts)
        .filter(([repo]) => repo)
        .map(([repo, title, description]) => ({ repo, title: title || repo, description: description || '' })),

    repo: {
      get: ({ picked, kits }) => (kits.some((kit) => kit.repo === picked) ? picked : (kits[0] || {}).repo || 'quickstart'),
      set(repo) {
        this.picked = repo
      },
    },

    // Copy button label.
    copyLabel: ({ copied, copyFailed }) => {
      if (copyFailed) return 'Copy failed'
      return copied ? 'Copied' : 'Copy'
    },

    /** One command block, rewritten by the repo and runner pickers. */
    command: ({ runners, runner, repo }) => ((runners[runner] || runners[0] || {}).command || '').split('{repo}').join(repo),
  },

  watch: {
    command() {
      this.copied = false
      this.copyFailed = false
    },
  },

  methods: {
    async copy() {
      try {
        await navigator.clipboard.writeText(this.command)
        this.copied = true
        // gtag() is defined only by the production analytics snippet, so this
        // is a no-op in dev, preview and SSR.
        window.gtag?.('event', 'copy_quickstart_command', { repo: this.repo, runner: ((this.runners[this.runner] || {}).label || '').toLowerCase() })
      } catch (e) {
        // navigator.clipboard is absent on non-secure origins, and can be denied.
        this.copyFailed = true
        setTimeout(() => { this.copyFailed = false }, 2000)
      }
    },
  },
}
</script>
