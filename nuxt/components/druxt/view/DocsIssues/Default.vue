<template>
  <div class="issue-groups">
    <!-- Links, so an area works without JavaScript; the count is of the search's results.
         The picked chip is styled by its class: NuxtLink sets aria-current
         itself, on the link to the exact current URL, and replaces any other. -->
    <nav class="issue-chips" aria-label="Filter by area">
      <NuxtLink
        v-for="chip in chips"
        :key="chip.value || 'all'"
        :to="chip.to"
        replace
        class="issue-chip"
        :class="{ 'is-active': chip.active }"
      >
        {{ chip.label }}<span class="issue-chip-count">{{ chip.count }}</span>
      </NuxtLink>
    </nav>
    <p class="issue-count" aria-live="polite">{{ countText }}</p>
    <section v-for="group in groups" :key="group.value || 'other'" class="issue-group">
      <h2 :id="group.id" class="issue-group-title">{{ group.label }}</h2>
      <details
        v-for="issue in group.issues"
        :id="issue.slug || null"
        :key="issue.entity.id"
        ref="issues"
        :data-slug="issue.slug"
        :open="issue.slug === open"
        class="issue"
        @toggle="toggled(issue, $event)"
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
          <DruxtEntity :type="issue.entity.type" :uuid="issue.entity.id" />
          <!-- A link, so it opens, and copies from its menu, without
               JavaScript. A plain click copies the issue's URL instead,
               as the docs' copy button copies code. -->
          <a
            v-if="issue.slug"
            :href="hrefOf(issue.slug)"
            class="issue-copy"
            aria-label="Copy a link to this fix"
            :data-state="copied.slug === issue.slug ? copied.state : null"
            @click="copyLink(issue.slug, $event)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
              <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
            </svg>
            <span class="issue-copy-label">
              <span :class="{ invisible: copied.slug === issue.slug }">Copy link</span>
              <span :class="{ invisible: copied.slug !== issue.slug }">{{ copiedLabel }}</span>
            </span>
          </a>
        </div>
      </details>
    </section>
    <span class="sr-only" role="status" aria-live="polite">{{ copiedAnnounce }}</span>
    <p v-if="!shown.length" class="issue-empty">
      Nothing matches. Try a shorter part of the error message, or ask in the Discord.
    </p>
  </div>
</template>

<script>
import { COPY_STATES, copyText } from '~/utils/copy-button'
import { ISSUE_TYPE, ISSUES_PATH, areaFromQuery, chipsOf, groupByArea, issueLocation, issueOf, slugFromHash } from '~/utils/issues'

/** What each issue's fix renders, fetched for every issue in one request. */
const INCLUDE = ['field_content', 'field_content.field_media', 'field_content.field_media.field_media_image']

/**
 * The docs_issues view's default display: issues grouped by area, each
 * closed until a reader opens it, with a chip per area. The area is the
 * route's, and filters the view's results here, so every chip has its count.
 *
 * The open issue is the route's: opening one goes to its URL, closing it
 * goes back to the page's, and arriving at an issue's URL opens it and
 * scrolls to it. An area or a search that hides the open issue goes back
 * to the page's URL too. Every fix is in the server-rendered HTML, so the page
 * reads without JavaScript.
 */
export default {
  props: {
    results: { type: Array, default: () => [] },
    view: { type: Object, default: () => ({}) },
    display: { type: Object, default: () => ({}) },
    pager: { type: Object, default: () => ({}) },
    count: { type: Number, default: 0 },
  },
  async fetch() {
    // Every issue with its fix's blocks in one request, which the Druxt store
    // keeps, so each issue's DruxtEntity and its blocks find theirs there
    // rather than asking one at a time. A signed-in editor's fixes are read
    // at the chosen revision instead, by the fix itself.
    const ids = this.results.map((result) => result.id)
    if (!ids.length || (this.$auth && this.$auth.loggedIn)) return
    await this.$store
      .dispatch('druxt/getCollection', {
        type: ISSUE_TYPE,
        query: {
          filter: { id: { condition: { path: 'id', operator: 'IN', value: ids } } },
          include: INCLUDE.join(','),
          'page[limit]': ids.length,
        },
      })
      .catch(() => null)
  },
  data: () => ({
    // The issue a click opened, which is already in view.
    clicked: '',
    // The issue whose link was last copied, and how that went.
    copied: { slug: '', state: '' },
  }),
  computed: {
    issues: ({ results }) => results.map(issueOf),
    area: ({ $route }) => areaFromQuery($route.query),
    shown: ({ issues, area }) => (area ? issues.filter((issue) => issue.area === area) : issues),
    chips: ({ issues, area, $route }) => chipsOf(issues, area, $route),
    groups() {
      return groupByArea(this.shown, this.$store.state.toc || [])
    },
    open: ({ $route }) => String(($route.params || {}).issue || ''),
    // The open issue is not in the list, because the area or the search hides it.
    hidden: ({ open, shown }) => Boolean(open) && !shown.some((issue) => issue.slug === open),
    copiedLabel: ({ copied }) => (COPY_STATES[copied.state] || {}).label || '',
    copiedAnnounce: ({ copied }) => (COPY_STATES[copied.state] || {}).announce || '',
    countText: ({ issues, shown }) => {
      const total = issues.length === 1 ? '1 issue' : `${issues.length} issues`
      return shown.length === issues.length ? total : `${shown.length} of ${total}`
    },
  },
  watch: {
    hidden(hidden) {
      if (hidden) this.close()
    },
    open(slug) {
      // A click opened this one where the reader is; anything else, such as
      // back and forward, moves to it.
      if (slug && slug !== this.clicked) this.reveal(slug)
      this.clicked = ''
    },
  },
  beforeDestroy() {
    clearTimeout(this.copyTimer)
  },
  mounted() {
    this.prefetch()
    // A link to an old heading names an issue by the id it had.
    const fromHash = !this.open && slugFromHash(this.$route.hash, this.issues)
    if (fromHash) {
      this.navigate('replace', { ...issueLocation(fromHash, this.$route.query), hash: '' })
      return
    }
    if (this.hidden) this.close()
    else if (this.open) this.reveal(this.open)
  },
  methods: {
    locationOf(slug) {
      return issueLocation(slug, this.$route.query)
    },

    /**
     * A reader opened or closed an issue. Opening goes to its URL, adding a
     * history entry; closing the open one goes back to the page's URL in
     * its place.
     */
    toggled(issue, event) {
      const isOpen = event.target.open
      if (!issue.slug || isOpen === (issue.slug === this.open)) return
      if (isOpen) {
        this.clicked = issue.slug
        this.navigate('push', this.locationOf(issue.slug))
      } else {
        this.close()
      }
    },

    /** An issue's own URL, without the list's filters, as a link to share. */
    hrefOf(slug) {
      return `${ISSUES_PATH}/${slug}`
    },

    /**
     * Copies an issue's full URL, and says so on its button for a moment.
     * A click with a modifier, or not with the main button, is left to the
     * browser, so the link still opens in a new tab or window.
     */
    async copyLink(slug, event) {
      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      clearTimeout(this.copyTimer)
      const state = await copyText(window.location.origin + this.hrefOf(slug))
      this.copied = { slug, state }
      if (state === 'copied') window.gtag?.('event', 'issue_link_copy', { issue: slug })
      this.copyTimer = setTimeout(() => {
        this.copied = { slug: '', state: '' }
      }, 2000)
    },

    /** Goes back to the page's URL, keeping the filters, in the open issue's place. */
    close() {
      this.navigate('replace', this.locationOf(''))
    },

    /**
     * Goes to a location. Nuxt's router returns no promise, and Vue Router's
     * rejects a navigation another replaces, which is not an error here.
     */
    navigate(method, location) {
      const navigation = this.$router[method](location)
      if (navigation && navigation.catch) navigation.catch(() => {})
    },

    /**
     * Loads the code of an issue's URL while the browser is idle, as a link
     * in view would, so the first issue opened does not wait for it. The
     * summaries that open issues are not links, and the issues' links are
     * hidden until one opens.
     */
    prefetch() {
      const slug = (this.issues.find((issue) => issue.slug) || {}).slug
      if (!slug) return
      const idle = window.requestIdleCallback || ((callback) => setTimeout(callback, 1))
      idle(() => {
        for (const component of this.$router.getMatchedComponents(this.locationOf(slug))) {
          if (typeof component === 'function' && !component.options) component()
        }
      })
    },

    /** Scrolls to an issue, once it has rendered. */
    reveal(slug) {
      this.$nextTick(() => {
        const element = (this.$refs.issues || []).find((details) => details.dataset.slug === slug)
        if (element) element.scrollIntoView({ block: 'start' })
      })
    },
  },
}
</script>
