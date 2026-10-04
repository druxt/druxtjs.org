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
      <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-1">
        <h1 class="text-3xl font-semibold tracking-tight">Changes in {{ label }}</h1>
        <a :href="overview" target="_self" class="link text-sm">Manage and publish in Drupal</a>
      </div>
      <p class="text-base-content/70 text-sm mb-5" data-testid="workspace-summary" aria-live="polite">
        <template v-if="$fetchState.pending">Reading the workspace…</template>
        <template v-else-if="$fetchState.error">Drupal did not answer, so the changes cannot be listed.</template>
        <template v-else-if="!pages.length">Nothing in this workspace differs from live.</template>
        <template v-else>
          {{ shown.length === pages.length ? count(pages.length) : `${shown.length} of ${count(pages.length)}` }}
          differ from live{{ pages.length >= limit ? ', and Drupal may hold more' : '' }}.
        </template>
      </p>

      <!-- Narrow the list: words, section, author, and the order. -->
      <div v-if="pages.length" class="workspace-tools" role="search" data-testid="workspace-tools">
        <label class="workspace-tool workspace-tool-search">
          <span class="sr-only">Search the changed pages</span>
          <input v-model="text" type="search" class="input input-sm input-bordered w-full" placeholder="Search titles and paths" />
        </label>
        <label class="workspace-tool">
          <span class="sr-only">Section</span>
          <select v-model="section" class="select select-sm select-bordered w-full">
            <option value="">All sections</option>
            <option v-for="choice of facets.sections" :key="choice.value" :value="choice.value">{{ choice.label }}</option>
          </select>
        </label>
        <label v-if="facets.authors.length > 1" class="workspace-tool">
          <span class="sr-only">Author</span>
          <select v-model="author" class="select select-sm select-bordered w-full">
            <option value="">Anyone</option>
            <option v-for="name of facets.authors" :key="name" :value="name">{{ name }}</option>
          </select>
        </label>
        <label class="workspace-tool">
          <span class="sr-only">Order</span>
          <select v-model="sort" class="select select-sm select-bordered w-full">
            <option v-for="(order, key) of sorts" :key="key" :value="key">{{ order.label }}</option>
          </select>
        </label>
      </div>

      <p v-if="pages.length && !shown.length" class="text-sm text-base-content/70">
        No changed page matches.
        <button type="button" class="link" @click="clear">Clear the filters</button>
      </p>

      <ul class="workspace-cards" data-testid="workspace-changes">
        <li v-for="page of shown" :key="page.id" class="workspace-card" data-testid="workspace-card">
          <div class="flex items-center justify-between gap-2 text-xs text-base-content/60">
            <span class="badge badge-sm badge-ghost">{{ page.sectionLabel }}</span>
            <span v-if="when(page.changed)">{{ when(page.changed) }}</span>
          </div>
          <h2 class="text-base font-semibold leading-snug">
            <NuxtLink v-if="page.path" :to="page.path" class="hover:underline">{{ page.title }}</NuxtLink>
            <span v-else>{{ page.title }}</span>
          </h2>
          <p class="text-xs text-base-content/60 truncate">
            {{ page.path || 'No path yet' }}<template v-if="page.author"> · {{ page.author }}</template>
          </p>
          <div class="workspace-card-actions">
            <a v-if="page.edit" :href="page.edit" target="_self" class="btn btn-xs btn-primary">Edit</a>
            <NuxtLink v-if="page.review" :to="page.review" class="btn btn-xs btn-ghost">Diff</NuxtLink>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>

<script>
import { workspaceCookie } from '~/lib/workspace'
import { CHANGES_LIMIT, SORTS, changesFrom, changesQuery, facetsOf, overviewPath, reviewOf } from '~/lib/workspace-review'

/**
 * The pages the editor's workspace has changed, as cards to edit, diff and
 * preview, with search, filters and an order.
 *
 * Read from JSON:API alone: with the workspace active, filtering pages on the
 * workspace their revision was made in leaves the ones it changed. Fetched in
 * the browser, so a stored page never holds an editor's list.
 */
export default {
  name: 'WorkspacePage',

  data: () => ({
    pages: [],
    workspaces: [],
    limit: CHANGES_LIMIT,
    sorts: SORTS,
    text: '',
    section: '',
    author: '',
    sort: 'newest',
  }),

  async fetch() {
    if (!this.signedIn) return
    await this.loadWorkspaces()
    if (!this.workspace) return
    const { data } = await this.$druxt.axios.get('/jsonapi/node/doc_page', { params: changesQuery(this.workspace) })
    this.pages = changesFrom(data)
  },

  fetchOnServer: false,

  computed: {
    signedIn: ({ $auth }) => Boolean($auth && $auth.loggedIn),
    workspace: ({ $store }) => $store.state.editor.workspace,
    label: ({ workspace, workspaces }) => (workspaces.find(({ id }) => id === workspace) || {}).label || workspace,
    overview: ({ workspace }) => overviewPath(workspace),
    facets: ({ pages }) => facetsOf(pages),
    shown: ({ pages, text, section, author, sort }) => reviewOf(pages, { text, section, author, sort }),
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

    clear() {
      this.text = ''
      this.section = ''
      this.author = ''
    },

    count: (n) => (n === 1 ? '1 page' : `${n} pages`),

    /** A date a reader reads, rather than an ISO 8601 string. */
    when(date) {
      const at = new Date(date)
      if (Number.isNaN(at.getTime())) return ''
      return at.toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })
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

<style scoped>
.workspace-tools {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
@media (min-width: 640px) {
  .workspace-tools {
    grid-template-columns: minmax(12rem, 2fr) repeat(auto-fit, minmax(8rem, 1fr));
  }
}
.workspace-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.75rem;
}
.workspace-card {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.875rem 1rem;
  border: 1px solid hsl(var(--b3));
  border-radius: var(--rounded-box, 0.5rem);
  background: hsl(var(--b1));
  transition: border-color var(--motion-fast) var(--motion-ease), box-shadow var(--motion-fast) var(--motion-ease);
}
.workspace-card:hover,
.workspace-card:focus-within {
  border-color: hsl(var(--p));
  box-shadow: 0 4px 14px -6px hsl(var(--n) / 0.25);
}
.workspace-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-top: auto;
  padding-top: 0.25rem;
}
</style>
