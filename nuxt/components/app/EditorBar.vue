<template>
  <!-- One floating bar for an editor: what they are on, and what they can do to it. -->
  <div
    v-if="show"
    class="editor-bar"
    role="region"
    aria-label="Editing controls"
    data-testid="editor-bar"
    :data-subject="subject.uuid"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <!-- The revision being read takes the bar over, and the controls stay put. -->
    <AppRevisionPill v-if="viewingRevision" bare />

    <template v-else>
      <span class="editor-bar-dot" :class="{ draft }" aria-hidden="true" />
      <span class="editor-bar-kind">{{ subject.kind }}</span>
      <span class="editor-bar-subject" :title="subject.label">{{ subject.label }}</span>
      <span v-if="draft" class="editor-bar-draft">Draft</span>
    </template>

    <button
      v-if="choices.length > 2"
      type="button"
      class="editor-bar-btn ghost"
      :aria-expanded="String(choosing)"
      aria-haspopup="menu"
      data-testid="editor-bar-choose"
      @click="choosing = !choosing"
    >
      {{ choices.length }} editable
      <svg class="editor-bar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 15l-6-6-6 6" /></svg>
    </button>

    <span class="editor-bar-sep" aria-hidden="true" />

    <AppEntityOperations
      v-if="operations.length"
      variant="bar"
      :operations="operations"
      :resource="resource"
      :label="subject.label"
      :edit-href="editUrl"
      :edit-label="editTitle"
      :state="state"
    />

    <!-- What is editable here, for a reader with no pointer to follow. -->
    <div v-if="choosing" class="editor-bar-choices" role="menu">
      <p class="editor-bar-choices-title">Editable on this page</p>
      <button
        v-for="choice of choices"
        :key="choice.uuid"
        type="button"
        class="editor-bar-choice"
        :class="{ on: choice.uuid === subject.uuid }"
        role="menuitem"
        @click="choose(choice)"
      >
        <span class="truncate">{{ choice.label }}</span>
        <span class="editor-bar-choice-kind">{{ choice.kind }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { hasEditorHint, operationsUrl, operationsOf } from '~/lib/entity-operations'
import { editHref, editLabel, pageSubject, subjectFromElement, subjectsOn } from '~/lib/editor-subject'
import { hasDraft, viewing } from '~/lib/revisions'

/** How long a subject survives the pointer leaving it, in milliseconds. */
const LINGER = 260

/**
 * The editor's bar: what the reader is on, and Drupal's operations for it.
 *
 * It floats, so an editor three screens down does not have to go back to the
 * title to reach anything. Its subject follows the pointer or the keyboard:
 * hovering a block binds the bar to that block and outlines it, and leaving
 * returns the bar to the page. A reader with no pointer chooses from a list,
 * which is also what a page with several entities offers.
 *
 * Drupal edits a paragraph inside its page's form, so a block's Edit opens
 * that form at the field the block lives in. The in-place editor is what will
 * make a block editable where it stands.
 */
export default {
  name: 'AppEditorBar',

  data: () => ({
    /** Drupal's operations for the page, once it has said what they are. */
    operations: [],
    /** The subject the pointer or the keyboard chose, if any. */
    active: null,
    /** What the page offers, for the chooser. */
    choices: [],
    choosing: false,
    hovering: false,
    linger: null,
  }),

  computed: {
    editor: ({ $store }) => $store.state.editor,
    signedIn: ({ $auth }) => Boolean($auth && $auth.loggedIn),
    page: ({ editor }) => pageSubject(editor.page),
    subject: ({ active, page }) => active || page,
    draft: ({ editor }) => hasDraft(editor.revisions),
    state: ({ editor }) => ((editor.page || {}).moderationState || null),
    resource: ({ page }) => (page ? { type: page.type, id: page.uuid } : null),
    /** On for a signed-in editor Drupal offers something to. */
    show: ({ signedIn, page, operations, viewingRevision }) =>
      Boolean(signedIn && page && (operations.length || viewingRevision)),
    /**
     * The revision takes the bar over while an older one is being read, or
     * while the diff is on. The working copy is what an editor sees by
     * default, so it stays the subject line with a draft chip: taking the bar
     * over for it would hide the controls on every page that has a draft.
     */
    viewingRevision: ({ editor, signedIn }) =>
      Boolean(signedIn && (editor.compare || viewing(editor.revisions, editor.version).kind === 'old')),
    editUrl: ({ subject, page, operations, $route }) => {
      const edit = operations.find((operation) => operation.key === 'edit-form')
      return editHref(subject, page, (edit || {}).href, $route.fullPath)
    },
    editTitle: ({ subject, page }) => editLabel(subject, page),
  },

  watch: {
    // The uuid, not the page: the page is a new object on every fetch, and
    // watching it turned reading the revisions into a loop that refetched
    // the page, which wrote the page again.
    'editor.page.uuid': {
      handler(uuid) {
        this.active = null
        this.choosing = false
        this.mark(null)
        this.load()
        // The bar is always here, so it keeps the page's revisions in the
        // store: the menu's submenu and the draft dot both read them.
        if (uuid && this.signedIn) this.loadRevisions(uuid)
        this.$nextTick(this.readChoices)
      },
      immediate: true,
    },
  },

  mounted() {
    // The bar floats over the page, so the page keeps room for it and its
    // last line is never the one under the bar.
    document.body.classList.add('has-editor-bar')
    // The pointer and the keyboard both choose a subject, and a touch reader
    // uses the list, so all three end at the same place.
    this.onPointer = (event) => this.bind(subjectFromElement(event.target))
    this.onFocus = (event) => this.bind(subjectFromElement(event.target))
    document.addEventListener('pointerover', this.onPointer, { passive: true })
    document.addEventListener('focusin', this.onFocus)
    this.readChoices()
  },

  beforeDestroy() {
    document.body.classList.remove('has-editor-bar')
    document.removeEventListener('pointerover', this.onPointer)
    document.removeEventListener('focusin', this.onFocus)
    clearTimeout(this.linger)
    this.mark(null)
  },

  methods: {
    /** Drupal's operations for the page, asked for once it is known. */
    async load() {
      this.operations = []
      const page = this.page
      if (!page || typeof document === 'undefined' || !hasEditorHint(document.cookie)) return
      try {
        const response = await fetch(operationsUrl(page.type, [page.uuid]), {
          credentials: 'same-origin',
          headers: { Accept: 'application/vnd.api+json' },
        })
        if (!response.ok) return
        const { data = [] } = await response.json()
        const resource = data.find((item) => item.id === page.uuid)
        if (resource) this.operations = operationsOf(resource)
      } catch (error) {
        // An editor's convenience, never a reason for the page to break.
      }
    },

    /** The page's revisions, for the submenu and for the draft dot. */
    async loadRevisions(uuid) {
      try {
        const { data } = await this.$druxt.axios.get(`/druxt-docs/doc-page/${uuid}/revisions`)
        this.$store.commit('setEditorRevisions', (data && data.data) || [])
      } catch (error) {
        // Without the list there is no submenu, and the page still reads.
        this.$store.commit('setEditorRevisions', [])
      }
    },

    /** What the page has anchored, for the chooser. */
    readChoices() {
      this.choices = typeof document === 'undefined' ? [] : subjectsOn(document, this.page)
    },

    /**
     * Binds the bar to a subject, or lets it fall back to the page.
     *
     * A moment's grace on the way out, so crossing a gap between two blocks
     * does not make the bar flicker back to the page and out again.
     *
     * @param {object|null} subject - The subject under the pointer.
     */
    bind(subject) {
      clearTimeout(this.linger)
      if (subject) {
        this.choosing = false
        // Frozen, and without the element: Vue would otherwise walk a DOM
        // node making it reactive, and the assignment never takes.
        const { el, ...rest } = subject
        this.active = Object.freeze(rest)
        this.mark(el)
        return
      }
      if (this.hovering) return
      this.linger = setTimeout(() => {
        this.active = null
        this.mark(null)
      }, LINGER)
    },

    /** Outlines what the bar is acting on, so the two cannot disagree. */
    mark(el) {
      if (this.marked && this.marked !== el) this.marked.removeAttribute('data-editing')
      this.marked = el || null
      if (el) el.setAttribute('data-editing', '')
    },

    /** Takes the reader to a chosen subject, and binds the bar to it. */
    choose(subject) {
      this.choosing = false
      const el = subject.el || (subject.uuid && document.querySelector(`[data-druxt-entity="${subject.uuid}"]`))
      const { el: _, ...rest } = subject
      this.active = subject.uuid === (this.page || {}).uuid ? null : Object.freeze(rest)
      this.mark(this.active ? el : null)
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  },
}
</script>
