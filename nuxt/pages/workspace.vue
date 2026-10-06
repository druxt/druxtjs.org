<template>
  <div class="wsr">
    <!-- Signed out: nothing says a workspace exists. -->
    <template v-if="!signedIn">
      <h1 class="wsr-h">Review changes</h1>
      <p class="wsr-sum">Sign in as a Druxt editor to see what a workspace changes.</p>
      <button type="button" class="wsr-cta" @click="$store.commit('setSignIn', true)">Sign in</button>
    </template>

    <!-- Reading live: offer the workspaces. -->
    <template v-else-if="!workspace">
      <span class="wsr-chip live"><span class="wsr-dot" />Live site</span>
      <h1 class="wsr-h">You are reading the live site</h1>
      <p class="wsr-sum">Choose a workspace to review what it changes. The site reloads in that workspace.</p>
      <ul v-if="workspaces.length" class="wsr-choices" data-testid="workspace-choices">
        <li v-for="choice of workspaces" :key="choice.id">
          <button type="button" class="wsr-choice" @click="choose(choice.id)">
            {{ choice.label }}
            <svg class="wsr-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </li>
      </ul>
    </template>

    <template v-else>
      <span class="wsr-chip"><span class="wsr-dot" />Workspace: {{ label }}</span>
      <div class="wsr-hrow">
        <div>
          <h1 ref="heading" class="wsr-h" tabindex="-1">Changes in {{ label }}</h1>
          <p class="wsr-sum" data-testid="workspace-summary" aria-live="polite">{{ summaryLine }}</p>
        </div>
        <a v-if="!$fetchState.pending && pages.length" :href="overview" target="_self" class="wsr-drupal">
          Manage and publish in Drupal
          <svg class="wsr-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
        </a>
      </div>

      <!-- Loading: rows of the real height, so nothing moves when they arrive. -->
      <ul v-if="$fetchState.pending" class="wsr-list" aria-busy="true" aria-label="Loading changes">
        <li v-for="n of 2" :key="n" class="wsr-skeleton">
          <span style="width: 32%" />
          <span style="width: 64%" />
          <span style="width: 44%" />
        </li>
      </ul>

      <!-- Drupal unreachable: say which request, and that nothing changed. -->
      <template v-else-if="$fetchState.error">
        <div class="wsr-alert" role="alert">
          <svg class="wsr-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3L12 4zM12 10v4M12 17h.01" /></svg>
          <p>
            <strong>Could not load the changes.</strong>
            {{ failure }} Nothing in {{ label }} or on the live site was changed.
          </p>
        </div>
        <div class="wsr-alert-actions">
          <button type="button" class="wsr-cta" @click="$fetch()">Try again</button>
          <a :href="overview" target="_self" class="wsr-drupal">Open Drupal</a>
        </div>
      </template>

      <!-- An empty workspace. -->
      <template v-else-if="!pages.length">
        <div class="wsr-empty">
          Pages you edit while reading the site in {{ label }}, and drafts written by the AI assistant, appear here
          until {{ label }} is published.
        </div>
        <a :href="overview" target="_self" class="wsr-drupal">Manage and publish in Drupal</a>
      </template>

      <template v-else>
        <AppWorkspaceFilters :value="filters" :facets="facets" :shown="shown.length" @input="filter" @clear="clear" />

        <div v-if="!shown.length" class="wsr-empty" data-testid="workspace-no-match">
          <p>No pages match {{ narrowing }}.</p>
          <button type="button" class="wsr-btn" @click="clear">Clear filters</button>
        </div>

        <ul v-else class="wsr-list" data-testid="workspace-changes">
          <AppWorkspaceRow v-for="page of shown" :key="page.id" :page="page" :edit-href="editHref(page)" />
        </ul>
      </template>
    </template>
  </div>
</template>

<script>
import { workspaceCookie } from '~/lib/workspace'
import {
  NO_FILTERS,
  STATUSES,
  changesFrom,
  changesQuery,
  createdPath,
  facetsOf,
  filtersFrom,
  overviewPath,
  queryOf,
  reviewOf,
  summaryOf,
} from '~/lib/workspace-review'

/**
 * What the editor's workspace changes compared with live, a row per page to
 * diff or edit, with search, filters and an order kept in the query string so
 * Edit's return lands on the same list.
 *
 * The pages come from JSON:API alone: with the workspace active, filtering on
 * the workspace each revision was made in leaves the ones it changed. Which of
 * them the workspace created comes from Drupal's workspace tracker. Fetched in
 * the browser, so a stored page never holds an editor's list.
 */
export default {
  name: 'WorkspacePage',

  data: () => ({
    pages: [],
    workspaces: [],
    failure: '',
  }),

  async fetch() {
    this.failure = ''
    if (!this.signedIn) return
    await this.loadWorkspaces()
    if (!this.workspace) return
    const ask = async (what, request) => {
      try {
        return await request()
      } catch (error) {
        const status = (error.response || {}).status
        this.failure = `The request to Drupal for ${what} ${status ? `answered ${status}` : 'did not answer'}.`
        throw error
      }
    }
    const [list, created] = await Promise.all([
      ask("this workspace's pages", () => this.$druxt.axios.get('/jsonapi/node/doc_page', { params: changesQuery(this.workspace) })),
      ask('the pages this workspace created', () => this.$druxt.axios.get(createdPath(this.workspace))),
    ])
    this.pages = changesFrom(list.data, (created.data || {}).data || [])
  },

  fetchOnServer: false,

  computed: {
    signedIn: ({ $auth }) => Boolean($auth && $auth.loggedIn),
    workspace: ({ $store }) => $store.state.editor.workspace,
    label: ({ workspace, workspaces }) => (workspaces.find(({ id }) => id === workspace) || {}).label || workspace,
    overview: ({ workspace }) => overviewPath(workspace),
    filters: ({ $route }) => filtersFrom($route.query),
    facets: ({ pages, filters }) => facetsOf(pages, filters),
    shown: ({ pages, filters }) => reviewOf(pages, filters),
    /** The line under the heading, for every state the list can be in. */
    summaryLine({ $fetchState, pages, shown, label }) {
      if ($fetchState.pending) return 'Loading changes…'
      if ($fetchState.error) return ''
      if (!pages.length) return `Nothing in ${label} differs from live.`
      return summaryOf(shown.length, pages.length)
    },

    /** What is filtering, for the no-match message: "“cors” in API". */
    narrowing({ filters, facets }) {
      const parts = []
      if (filters.text) parts.push(`“${filters.text}”`)
      if (filters.status) parts.push(`marked ${STATUSES[filters.status].toLowerCase()}`)
      if (filters.section) parts.push(`in ${(facets.sections.find(({ value }) => value === filters.section) || {}).label}`)
      if (filters.author) parts.push(`changed by ${filters.author}`)
      return parts.join(' ') || 'these filters'
    },
  },

  methods: {
    /** The workspaces this editor may read the site in, by machine name and label. */
    async loadWorkspaces() {
      try {
        const { data } = await this.$druxt.axios.get('/jsonapi/workspace/workspace', {
          params: { 'fields[workspace--workspace]': 'drupal_internal__id,label', sort: 'label' },
        })
        this.workspaces = ((data && data.data) || []).map(({ attributes }) => ({
          id: attributes.drupal_internal__id,
          label: attributes.label,
        }))
      } catch (error) {
        // Without the list the page still names the workspace by its id.
      }
    },

    /** Reads the site in a workspace, the way the editor bar does: a fresh load. */
    choose(id) {
      document.cookie = workspaceCookie(id, window.location.protocol === 'https:')
      window.location.reload()
    },

    /** Applies the filters, in the query string so a return trip keeps them. */
    filter(filters) {
      this.$router.replace({ query: queryOf(filters) }).catch(() => {})
    },

    clear() {
      this.filter({ ...NO_FILTERS, sort: this.filters.sort })
    },

    /** Drupal's form for the page, coming back to this list as it is filtered. */
    editHref(page) {
      if (!page.nid) return null
      return `/node/${page.nid}/edit?destination=${encodeURIComponent(this.$route.fullPath)}`
    },
  },

  head() {
    // An editor's working view: never indexed.
    return {
      title: 'Workspace changes',
      meta: [{ hid: 'robots', name: 'robots', content: 'noindex' }],
    }
  },
}
</script>

<style>
/* The review's colours beyond daisyUI's: the diff's addition green for New,
   the draft amber for Changed, teal for the AI author. */
.wsr {
  --wsr-mut: hsl(var(--bc) / 0.68);
  --wsr-faint: hsl(var(--bc) / 0.45);
  --wsr-ptint: color-mix(in srgb, #53b0eb 18%, hsl(var(--b1)));
  --wsr-pfill: #036397;
  --wsr-pc: #ffffff;
  --wsr-addbg: #e3f5ee;
  --wsr-addfg: #0d6b4f;
  --wsr-warnbg: #fff4e0;
  --wsr-warn: #b86e00;
  --wsr-aibg: #d9f5f2;
  --wsr-ai: #0b6b62;
  --wsr-err: #c7431b;
  --wsr-errbg: #fde9e3;
  --wsr-scrim: rgba(15, 23, 32, 0.38);
  --wsr-shadow: 0 12px 32px -8px rgba(15, 23, 32, 0.22), 0 2px 6px rgba(15, 23, 32, 0.08);
}
[data-theme='dark'] .wsr {
  --wsr-pfill: #53b0eb;
  --wsr-pc: #08121b;
  --wsr-addbg: #12342b;
  --wsr-addfg: #7fe0bd;
  --wsr-warnbg: #3a2a10;
  --wsr-warn: #ffb547;
  --wsr-aibg: #123634;
  --wsr-ai: #5fe0d2;
  --wsr-err: #ff7a56;
  --wsr-errbg: #3d1d14;
  --wsr-scrim: rgba(0, 0, 0, 0.55);
  --wsr-shadow: 0 14px 36px -8px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4);
}
</style>

<style scoped>
.wsr {
  max-width: 1040px;
  margin: 0 auto;
  /* The editor bar sits bottom left: the last row's actions scroll clear of it. */
  padding-bottom: 104px;
}
.wsr-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--wsr-ptint);
  color: hsl(var(--pf));
  font-size: 12.5px;
  font-weight: 600;
}
.wsr-chip.live {
  background: var(--wsr-addbg);
  color: var(--wsr-addfg);
}
.wsr-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #53b0eb;
}
.wsr-chip.live .wsr-dot {
  background: currentColor;
}
.wsr-hrow {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 24px;
}
.wsr-h {
  margin: 10px 0 4px;
  font-size: 32px;
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.02em;
  text-wrap: balance;
  outline: none;
}
.wsr-sum {
  margin: 0;
  color: var(--wsr-mut);
  font-size: 14.5px;
}
.wsr-drupal {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  color: hsl(var(--pf));
  font-weight: 600;
}
.wsr-ic {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex: none;
}
.wsr-cta {
  margin-top: 16px;
  height: 44px;
  padding: 0 16px;
  border-radius: 8px;
  background: var(--wsr-pfill);
  color: var(--wsr-pc);
  font-weight: 600;
}
.wsr-btn {
  height: 44px;
  padding: 0 14px;
  border: 1px solid hsl(var(--b3));
  border-radius: 8px;
  background: hsl(var(--b1));
  font-weight: 600;
}
.wsr-cta:focus-visible,
.wsr-btn:focus-visible,
.wsr-choice:focus-visible,
.wsr-drupal:focus-visible {
  outline: 2px solid hsl(var(--pf));
  outline-offset: 2px;
}
.wsr-choices {
  margin-top: 20px;
  display: grid;
  gap: 8px;
}
.wsr-choice {
  width: 100%;
  height: 56px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid hsl(var(--b3));
  border-radius: 10px;
  background: hsl(var(--b1));
  font-weight: 600;
  text-align: left;
}
.wsr-choice:hover {
  border-color: hsl(var(--p));
}
.wsr-chev {
  width: 16px;
  height: 16px;
  stroke: var(--wsr-mut);
  fill: none;
  stroke-width: 1.8;
}
.wsr-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.wsr-skeleton {
  display: grid;
  gap: 12px;
  padding: 20px 18px;
  border: 1px solid hsl(var(--b3));
  border-radius: 12px;
  margin-top: 24px;
}
.wsr-skeleton + .wsr-skeleton {
  margin-top: 0;
}
.wsr-skeleton span {
  height: 10px;
  border-radius: 5px;
  background: hsl(var(--b2));
}
.wsr-alert {
  margin-top: 24px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px 16px;
  border-radius: 10px;
  background: var(--wsr-errbg);
  color: var(--wsr-err);
}
.wsr-alert p {
  margin: 0;
}
.wsr-alert-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}
.wsr-empty {
  margin: 24px 0 16px;
  padding: 18px;
  border: 1px dashed hsl(var(--b3));
  border-radius: 12px;
  color: var(--wsr-mut);
  display: grid;
  gap: 12px;
  justify-items: start;
}
.wsr-empty p {
  margin: 0;
  color: hsl(var(--bc));
}
@media (max-width: 639px) {
  .wsr-h {
    font-size: 26px;
  }
}
</style>
