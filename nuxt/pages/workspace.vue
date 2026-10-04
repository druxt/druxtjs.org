<template>
  <div class="max-w-content">
    <template v-if="!signedIn">
      <h1 class="text-3xl font-semibold tracking-tight mb-2">Workspace changes</h1>
      <p class="text-base-content/70">
        <NuxtLink to="/login" class="link">Sign in</NuxtLink> to review the changes in a workspace.
      </p>
    </template>

    <!-- Reading live: say so, and offer the workspaces to review. -->
    <template v-else-if="!workspace">
      <h1 class="text-3xl font-semibold tracking-tight mb-2">Workspace changes</h1>
      <p class="text-base-content/70 mb-6">You are reading the live site. Choose a workspace to review its changes.</p>
      <ul v-if="workspaces.length" class="flex flex-wrap gap-2" data-testid="workspace-choices">
        <li v-for="choice of workspaces" :key="choice.id">
          <button type="button" class="btn btn-sm btn-outline" @click="choose(choice.id)">{{ choice.label }}</button>
        </li>
      </ul>
    </template>

    <template v-else>
      <h1 class="text-3xl font-semibold tracking-tight mb-1">Changes in {{ label }}</h1>
      <p class="text-base-content/70 text-sm mb-6" data-testid="workspace-summary">
        <template v-if="$fetchState.pending">Reading the workspace…</template>
        <template v-else-if="$fetchState.error">Drupal did not answer, so the changes cannot be listed.</template>
        <template v-else-if="!changes.length">Nothing in this workspace differs from live.</template>
        <template v-else>
          {{ changes.length === 1 ? '1 page differs' : `${changes.length} pages differ` }} from live{{
            changes.length >= limit ? ', and Drupal may hold more' : ''
          }}. Each opens with its changes marked.
        </template>
      </p>

      <ul
        v-if="changes.length"
        class="text-sm border border-base-300 rounded-lg divide-y divide-base-300"
        data-testid="workspace-changes"
      >
        <li v-for="page of changes" :key="page.id" class="px-4 py-3">
          <NuxtLink v-if="page.review" :to="page.review" class="link font-medium">{{ page.title }}</NuxtLink>
          <span v-else class="font-medium">{{ page.title }}</span>
          <p class="text-base-content/60 mt-0.5">
            <span>{{ page.path || 'No path yet' }}</span>
            <span v-if="when(page.changed)"> · changed {{ when(page.changed) }}</span>
          </p>
        </li>
      </ul>

      <p class="mt-6 text-sm">
        <a :href="overview" target="_self" class="link">Manage and publish this workspace in Drupal</a>
      </p>
    </template>
  </div>
</template>

<script>
import { CHANGES_LIMIT, changesFrom, changesQuery, overviewPath, workspaceCookie } from '~/lib/workspace'

/**
 * The pages the editor's workspace has changed, each a link to the page with
 * its changes against live marked.
 *
 * Read from JSON:API alone: with the workspace active, filtering pages on the
 * workspace their revision was made in leaves the ones it changed. Fetched in
 * the browser, so a stored page never holds an editor's list.
 */
export default {
  name: 'WorkspacePage',

  data: () => ({
    changes: [],
    workspaces: [],
    limit: CHANGES_LIMIT,
  }),

  async fetch() {
    if (!this.signedIn) return
    await this.loadWorkspaces()
    if (!this.workspace) return
    const { data } = await this.$druxt.axios.get('/jsonapi/node/doc_page', { params: changesQuery(this.workspace) })
    this.changes = changesFrom(data)
  },

  fetchOnServer: false,

  computed: {
    signedIn: ({ $auth }) => Boolean($auth && $auth.loggedIn),
    workspace: ({ $store }) => $store.state.editor.workspace,
    label: ({ workspace, workspaces }) => (workspaces.find(({ id }) => id === workspace) || {}).label || workspace,
    overview: ({ workspace }) => overviewPath(workspace),
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

    /** A date a reader reads, rather than an ISO 8601 string. */
    when(date) {
      const at = new Date(date)
      if (Number.isNaN(at.getTime())) return ''
      return at.toLocaleDateString('en-AU', { year: 'numeric', month: 'long', day: 'numeric' })
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
