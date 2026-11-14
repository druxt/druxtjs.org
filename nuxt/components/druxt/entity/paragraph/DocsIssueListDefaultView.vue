<template>
  <div :data-druxt-entity="(entity || {}).id || false" :data-druxt-type="(entity || {}).type" class="issue-list" data-testid="issue-list">
    <!-- A plain GET form, so a search works before the page hydrates and
         without JavaScript. Once it has, typing searches as it goes. -->
    <form method="get" :action="$route.path" class="issue-tools" role="search" @submit.prevent="search(true)">
      <label class="issue-search">
        <span class="sr-only">Search troubleshooting</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          v-model="query"
          name="q"
          type="search"
          placeholder="Search, or paste an error message"
          data-testid="issue-search"
          @input="search(false)"
        />
      </label>
      <input v-if="area" type="hidden" :name="areaKey" :value="area" />
    </form>
    <DruxtView v-if="viewProps" v-bind="viewProps" @input="onInput" />
  </div>
</template>

<script>
import { DruxtViewsPageMixin } from 'druxt-views'
import { AREA_KEY, ISSUES_PAGE, areaFromQuery } from '~/utils/issues'

/** How long typing has to pause before the list follows it. */
const DEBOUNCE = 250

/**
 * The Issues list block: every troubleshooting issue, by area, with a
 * search, where the editor put it in the page.
 *
 * The docs_issues view gives the issues, filtered by the words of the
 * search. The search is in the URL through druxt-views' page model, and
 * the area through the view's wrapper, so a filtered list can be shared,
 * and changing either keeps the open issue's URL.
 */
export default {
  mixins: [DruxtViewsPageMixin],
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
    page: { type: Object, default: () => ISSUES_PAGE },
  },
  data() {
    // Computed values do not exist yet, so the search's place in the URL is read directly.
    return { query: String((this.$route.query || {})[ISSUES_PAGE.filters.q.query] || '') }
  },
  computed: {
    areaKey: () => AREA_KEY,
    area: ({ $route }) => areaFromQuery($route.query),
  },
  watch: {
    // Back and forward change the search; the box follows them.
    'model.filter.q'(q) {
      if ((q || '') !== this.query.trim()) this.query = q || ''
    },
  },
  beforeDestroy() {
    clearTimeout(this.timer)
  },
  methods: {
    /**
     * Puts the search in the URL, which refetches the view: at once for a
     * submit, after a pause in typing otherwise.
     */
    search(now) {
      clearTimeout(this.timer)
      const run = () => {
        const filter = { ...((this.model || {}).filter || {}) }
        const q = this.query.trim()
        if (q) filter.q = q
        else delete filter.q
        this.onInput({ filter, page: null, sort: (this.model || {}).sort })
      }
      if (now) run()
      else this.timer = setTimeout(run, DEBOUNCE)
    },
  },
}
</script>
