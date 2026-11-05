<template>
  <div class="issue-list" data-testid="issue-list">
    <!-- Search and the area chips need the browser; without them every issue is listed, closed. -->
    <div v-if="enhanced" class="issue-tools">
      <label class="issue-search">
        <span class="sr-only">Search troubleshooting</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input v-model="query" type="search" placeholder="Search, or paste an error message" data-testid="issue-search" />
      </label>
      <div class="issue-chips" role="group" aria-label="Filter by area">
        <button
          v-for="chip in chips"
          :key="chip.value"
          type="button"
          class="issue-chip"
          :aria-pressed="String(area === chip.value)"
          @click="area = chip.value"
        >
          {{ chip.label }}<span class="issue-chip-count">{{ chip.count }}</span>
        </button>
      </div>
      <p class="issue-count" aria-live="polite">{{ countText }}</p>
    </div>

    <section v-for="group in groups" v-show="visible(group).length" :key="group.value || 'other'" class="issue-group">
      <h2 :id="group.id" class="issue-group-title">{{ group.label }}</h2>
      <details
        v-for="issue in group.issues"
        v-show="shown(issue)"
        :id="issue.id"
        :key="issue.entity.id"
        ref="issues"
        class="issue"
      >
        <summary>
          <span class="issue-title">
            <template v-for="(part, index) in issue.segments">
              <code v-if="part.code" :key="index">{{ part.text }}</code>
              <span v-else :key="index">{{ part.text }}</span>
            </template>
          </span>
          <span v-if="issue.summary" class="issue-summary">{{ issue.summary }}</span>
        </summary>
        <div class="issue-fix">
          <DruxtEntity v-for="child in childrenOf(issue.entity)" :key="child.id" :type="child.type" :uuid="child.id" />
          <a :href="`#${issue.id}`" class="issue-link">Link to this fix</a>
        </div>
      </details>
    </section>

    <p v-if="enhanced && !shownCount" class="issue-empty">
      Nothing matches. Try a shorter part of the error message, or ask in the Discord.
    </p>
  </div>
</template>

<script>
import { AREAS, groupByArea, issueOf, matches } from '~/utils/issues'

/**
 * A run of troubleshooting issues: grouped by area, each one closed until a
 * reader opens it, with a search and area chips once the page hydrates.
 *
 * Every fix is in the server-rendered HTML, so the page reads without
 * JavaScript and a link to an issue's id opens it.
 */
export default {
  props: {
    issues: { type: Array, required: true },
    childrenOf: { type: Function, required: true },
    /** How many earlier lists on the page had each area, for its heading ids. */
    repeats: { type: Object, default: () => ({}) },
  },

  data: () => ({
    enhanced: false,
    query: '',
    area: '',
    // Each issue's searchable text, read from the rendered page once mounted.
    texts: {},
  }),

  computed: {
    list: ({ issues }) => issues.map(issueOf),
    groups: ({ list, repeats }) => groupByArea(list, repeats),
    shownCount() {
      return this.list.filter((issue) => this.shown(issue)).length
    },
    chips() {
      const found = (area) => this.list.filter((issue) => (!area || issue.area === area) && this.found(issue)).length
      return [{ value: '', label: 'All' }, ...AREAS]
        .map((area) => ({ ...area, count: found(area.value) }))
        .filter((chip) => !chip.value || this.list.some((issue) => issue.area === chip.value))
    },
    countText() {
      const total = this.list.length
      return this.shownCount === total ? `${total} issues` : `${this.shownCount} of ${total} issues`
    },
  },

  watch: {
    '$route.hash'(hash) {
      this.open(hash, true)
    },
  },

  mounted() {
    this.enhanced = true
    this.$nextTick(() => {
      for (const element of this.$refs.issues || []) this.$set(this.texts, element.id, element.textContent)
      this.open(this.$route.hash, false)
    })
  },

  methods: {
    found(issue) {
      return matches(this.query, this.texts[issue.id] || `${issue.title} ${issue.summary}`)
    },
    shown(issue) {
      return (!this.area || issue.area === this.area) && this.found(issue)
    },
    visible(group) {
      return group.issues.filter((issue) => this.shown(issue))
    },
    /** Opens the issue a URL hash names, clearing a filter that hides it. */
    open(hash, scroll) {
      const id = decodeURIComponent(String(hash || '').replace(/^#/, ''))
      const element = (this.$refs.issues || []).find((details) => details.id === id)
      if (!element) return
      this.query = ''
      this.area = ''
      element.open = true
      if (scroll) this.$nextTick(() => element.scrollIntoView({ block: 'start' }))
    },
  },
}
</script>
