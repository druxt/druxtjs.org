<template>
  <!-- One floating bar for an editor: what they are on, and what they can do to it. -->
  <div
    v-if="show"
    class="editor-bar"
    :class="{ idle, docked: Boolean(dock), locked }"
    :style="dockStyle"
    role="region"
    aria-label="Editing controls"
    data-testid="editor-bar"
    :data-state="idle ? 'idle' : 'active'"
    :data-subject="idle ? null : subject.uuid"
    @mouseenter="hovering = true"
    @mouseleave="hovering = false"
  >
    <!-- The way into Drupal, and the only thing left when the page is not
         Drupal's. It leads the bar rather than sitting apart from it, so an
         editor looks in one place wherever they are. -->
    <button
      type="button"
      class="editor-bar-orb"
      :class="{ draft }"
      :aria-expanded="String(gateway)"
      aria-haspopup="menu"
      :aria-label="idle ? 'Open Drupal' : 'Drupal'"
      :title="idle ? 'Open Drupal' : 'Drupal'"
      data-testid="editor-bar-orb"
      @click="gateway = !gateway"
    >
      <svg class="editor-bar-orb-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.6c2.4 2.8 6.6 5.2 6.6 10a6.6 6.6 0 1 1-13.2 0c0-4.8 4.2-7.2 6.6-10z" />
      </svg>
    </button>

    <template v-if="!idle">
      <!-- The revision being read takes the bar over, and the controls stay put. -->
      <AppRevisionPill v-if="viewingRevision" bare />

      <template v-else>
        <span class="editor-bar-kind">{{ subject.kind }}</span>
        <span class="editor-bar-subject" :title="subject.label">{{ subject.label }}</span>
        <span v-if="draft" class="editor-bar-draft">Draft</span>
        <!-- Locked on a block, so the bar stays on it while the pointer goes
             anywhere else. Letting go is one press, and so is Escape. -->
        <button
          v-if="locked"
          type="button"
          class="editor-bar-unlock"
          aria-label="Stop editing this block"
          title="Stop editing this block (Escape)"
          data-testid="editor-bar-unlock"
          @click="unlock"
        >
          <svg class="editor-bar-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </template>

      <button
        v-if="choices.length > 1"
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
    </template>

    <!-- What is editable here, for a reader with no pointer to follow. -->
    <div v-if="choosing && !idle" class="editor-bar-choices" role="menu">
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

    <!-- Drupal, from wherever the reader is standing. -->
    <div v-if="gateway" class="editor-bar-gateway" role="menu" data-testid="editor-bar-gateway">
      <p v-if="destinations.note" class="editor-bar-gateway-note">{{ destinations.note }}</p>
      <a
        v-for="link of destinations.links"
        :key="link.key"
        class="editor-bar-choice"
        role="menuitem"
        :href="link.href"
        @click="gateway = false"
      >
        <span class="truncate">{{ link.label }}</span>
      </a>
    </div>
  </div>
</template>

<script>
import { findAnchor } from '~/lib/anchors'
import { hasEditorHint, operationsUrl, operationsOf } from '~/lib/entity-operations'
import { gatewayFor } from '~/lib/editor-gateway'
import { editHref, editLabel, pageSubject, subjectFromElement, subjectsOn } from '~/lib/editor-subject'
import { hasDraft, viewing } from '~/lib/revisions'

/** How long a subject survives the pointer leaving it, in milliseconds. */
const LINGER = 260

/** The gap the bar keeps from the block it is docked to, in pixels. */
const DOCK_GAP = 10

/** Below this width the bar spans the screen, so there is nowhere to dock it. */
const DOCK_MIN_WIDTH = 640

/** What the bar measures as, before it has been rendered once. */
const DOCK_FALLBACK = { width: 320, height: 44 }

/** A click on one of these is the reader's own, never a choice of block. */
const INTERACTIVE = 'a, button, input, textarea, select, summary, label, [role="button"]'

/** One spelling of a path, so the route and the store's page compare equal. */
const normalise = (path) => {
  const trimmed = String(path || '').split('?')[0].split('#')[0]
  return trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : trimmed
}

/**
 * The editor's bar: what the reader is on, and Drupal's operations for it.
 *
 * It floats, so an editor three screens down does not have to go back to the
 * title to reach anything. Its subject follows the pointer or the keyboard:
 * hovering a block binds the bar to that block, outlines it, and brings the
 * bar up beside it, so the block's operations are where the block is rather
 * than at the foot of the screen. Clicking the block locks the bar to it and
 * the bar drops back down, which leaves the reader free to move the pointer
 * without losing what they chose. A reader with no pointer chooses from a
 * list, which a page with more than one editable thing offers.
 *
 * Most of this site is Drupal's, but not all of it: the references are
 * generated and a bad URL has no page at all. There the bar keeps only its
 * orb, which is the way into the backend from wherever the reader is.
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
    /** Whether that subject was chosen outright, rather than hovered. */
    locked: false,
    /** Where the bar sits while it is beside its block, or null at the foot. */
    dock: null,
    /** What the page offers, for the chooser. */
    choices: [],
    choosing: false,
    gateway: false,
    hovering: false,
    /** Whether this browser has been told the account may edit. */
    hinted: false,
    linger: null,
    frame: null,
  }),

  computed: {
    editor: ({ $store }) => $store.state.editor,
    signedIn: ({ $auth }) => Boolean($auth && $auth.loggedIn),
    /**
     * The store's page, but only where it is this route's page.
     *
     * One store value serves every route, and only a Drupal page writes it.
     * Without this the bar went on naming, and offering operations on, the
     * page the reader had left.
     */
    current: ({ editor, $route }) => {
      const page = editor.page
      if (!page || !page.path || !$route) return null
      return normalise(page.path) === normalise($route.path) ? page : null
    },
    page: ({ current }) => pageSubject(current),
    subject: ({ active, page }) => active || page,
    draft: ({ editor, page }) => Boolean(page) && hasDraft(editor.revisions),
    state: ({ current }) => (current || {}).moderationState || null,
    resource: ({ page }) => (page ? { type: page.type, id: page.uuid } : null),
    /** On for a signed-in editor, on every page: the orb is the constant. */
    show: ({ signedIn, hinted }) => Boolean(signedIn && hinted),
    /** Nothing here is Drupal's, so the bar is its orb and nothing else. */
    idle: ({ page, operations, viewingRevision }) => !(page && (operations.length || viewingRevision)),
    /**
     * Whether the site failed to find a page for this address.
     *
     * Nuxt's own error state, rather than a second bar rendered by the error
     * layout: the error layout does not always replace the default one, and
     * two bars on a 404 is one too many. An address with nothing behind it is
     * the one case where a redirect is the thing to offer.
     */
    missing: ({ $nuxt }) => Boolean($nuxt && $nuxt.nuxt && $nuxt.nuxt.err),
    /** Where the orb goes from here, chosen from where the reader is standing. */
    destinations: ({ $route, missing }) => gatewayFor($route ? $route.path : '/', { missing }),
    /**
     * The revision takes the bar over while an older one is being read, or
     * while the diff is on. The working copy is what an editor sees by
     * default, so it stays the subject line with a draft chip: taking the bar
     * over for it would hide the controls on every page that has a draft.
     */
    viewingRevision: ({ editor, signedIn, page }) =>
      Boolean(signedIn && page && (editor.compare || viewing(editor.revisions, editor.version).kind === 'old')),
    editUrl: ({ subject, page, operations, $route }) => {
      const edit = operations.find((operation) => operation.key === 'edit-form')
      return editHref(subject, page, (edit || {}).href, $route.fullPath)
    },
    editTitle: ({ subject, page }) => editLabel(subject, page),
    dockStyle: ({ dock }) => (dock ? { top: `${dock.top}px`, left: `${dock.left}px` } : null),
    /** Path and page together: either changing is a new context for the bar. */
    contextKey: ({ current }) => (current ? `${normalise(current.path)}|${current.uuid}` : null),
  },

  watch: {
    // The hint arrives with the login, which is after this mounted, so the
    // cookie is read again whenever the account changes rather than once.
    //
    // Deliberately not immediate. The server cannot read the browser's
    // cookies, so it renders no bar; a client that read them before mounting
    // rendered one, and hydrating an element onto the server's comment threw
    // and left the bar a comment for the life of the page.
    signedIn(on) {
      this.refreshHint()
      if (!on) {
        clearInterval(this.hintPoll)
        this.reset()
        return
      }
      // Drupal sets the cookie on the login the grant runs first, and the
      // browser can see the token before it sees the cookie. A few looks
      // rather than one, so signing in without leaving the page still
      // brings the bar up.
      if (this.hinted) return
      let tries = 0
      clearInterval(this.hintPoll)
      this.hintPoll = setInterval(() => {
        this.refreshHint()
        if (this.hinted || (tries += 1) > 12) clearInterval(this.hintPoll)
      }, 300)
    },

    // Menus belong to the page they were opened on, and the chooser reads
    // what this page anchored.
    '$route.fullPath'() {
      this.choosing = false
      this.gateway = false
      this.refreshHint()
      this.$nextTick(this.readChoices)
    },

    // A key, not the page: the page is a new object on every fetch, and
    // watching it turned reading the revisions into a loop that refetched
    // the page, which wrote the page again.
    contextKey: {
      handler() {
        this.reset()
        this.load()
        // The bar is always here, so it keeps the page's revisions in the
        // store: the menu's submenu and the draft dot both read them.
        const uuid = (this.current || {}).uuid
        if (uuid && this.signedIn) this.loadRevisions(uuid)
        this.$nextTick(this.readChoices)
      },
      immediate: true,
    },
  },

  mounted() {
    this.refreshHint()
    // The bar floats over the page, so the page keeps room for it and its
    // last line is never the one under the bar.
    document.body.classList.add('has-editor-bar')
    // The pointer and the keyboard both choose a subject, and a touch reader
    // uses the list, so all three end at the same place.
    this.onPointer = (event) => this.bind(subjectFromElement(event.target))
    this.onFocus = (event) => this.bind(subjectFromElement(event.target))
    this.onClick = (event) => this.lockOn(event)
    this.onKey = (event) => {
      if (event.key !== 'Escape') return
      if (this.gateway) this.gateway = false
      else if (this.choosing) this.choosing = false
      else if (this.locked) this.unlock()
    }
    // A docked bar is placed against a block's position, and both scrolling
    // and resizing move it. One frame at a time: these fire in bursts.
    this.onViewport = () => {
      if (this.frame || !this.dock) return
      this.frame = requestAnimationFrame(() => {
        this.frame = null
        this.place()
      })
    }
    document.addEventListener('pointerover', this.onPointer, { passive: true })
    document.addEventListener('focusin', this.onFocus)
    document.addEventListener('click', this.onClick)
    document.addEventListener('keydown', this.onKey)
    window.addEventListener('scroll', this.onViewport, { passive: true })
    window.addEventListener('resize', this.onViewport)
    this.readChoices()
  },

  beforeDestroy() {
    document.body.classList.remove('has-editor-bar')
    document.removeEventListener('pointerover', this.onPointer)
    document.removeEventListener('focusin', this.onFocus)
    document.removeEventListener('click', this.onClick)
    document.removeEventListener('keydown', this.onKey)
    window.removeEventListener('scroll', this.onViewport)
    window.removeEventListener('resize', this.onViewport)
    clearTimeout(this.linger)
    clearInterval(this.hintPoll)
    if (this.frame) cancelAnimationFrame(this.frame)
    this.mark(null)
  },

  methods: {
    /**
     * Whether Drupal has told this browser the account may edit.
     *
     * The cookie is what turns the bar on, and it is set by the login, so it
     * is read again on every account and route change rather than once. Read
     * once at mount, an editor who signed in without leaving the page got no
     * bar until they navigated.
     */
    refreshHint() {
      this.hinted = typeof document !== 'undefined' && hasEditorHint(document.cookie)
    },

    /** Back to the page itself, with nothing held over from the last one. */
    reset() {
      this.active = null
      this.locked = false
      this.dock = null
      this.choosing = false
      this.gateway = false
      this.mark(null)
    },

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
        // The page can have been left while Drupal was answering.
        if (resource && this.page && this.page.uuid === page.uuid) this.operations = operationsOf(resource)
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
      // A locked subject was chosen outright, and the pointer moving on is
      // not a reason to take it away again.
      if (this.locked) return
      clearTimeout(this.linger)
      if (subject) {
        this.choosing = false
        // Frozen, and without the element: Vue would otherwise walk a DOM
        // node making it reactive, and the assignment never takes.
        const { el, ...rest } = subject
        this.active = Object.freeze(rest)
        this.mark(el)
        this.$nextTick(this.place)
        return
      }
      if (this.hovering) return
      this.linger = setTimeout(() => {
        this.active = null
        this.dock = null
        this.mark(null)
      }, LINGER)
    },

    /**
     * Brings the bar up beside the block it is acting on.
     *
     * The operations belong to the block, so they are put where the block is.
     * Above it where there is room and below it where there is not, and held
     * inside the screen either way. A narrow screen has nowhere to put it, and
     * so does a block scrolled out of sight: both leave the bar at the foot.
     */
    place() {
      const el = this.marked
      if (!el || this.locked || typeof window === 'undefined' || window.innerWidth < DOCK_MIN_WIDTH) {
        this.dock = null
        return
      }
      const rect = el.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        this.dock = null
        return
      }
      const self = this.$el ? this.$el.getBoundingClientRect() : DOCK_FALLBACK
      const height = self.height || DOCK_FALLBACK.height
      const width = self.width || DOCK_FALLBACK.width
      const above = rect.top >= height + DOCK_GAP + 8
      this.dock = {
        top: Math.round(above ? rect.top - height - DOCK_GAP : rect.bottom + DOCK_GAP),
        left: Math.round(Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))),
      }
    },

    /**
     * A click inside the bound block chooses it outright.
     *
     * Hovering brings the bar to a block, and that is enough to reach its
     * operations, but only while the pointer stays. Clicking the block says
     * "this one", and the bar drops back to the foot holding it, so the
     * pointer is free. Anything the reader clicked for its own sake, and any
     * click that ends a text selection, is left alone.
     *
     * @param {Event} event - The click.
     */
    lockOn(event) {
      if (this.locked || !this.active || !event.target) return
      if (this.$el && this.$el.contains(event.target)) return
      if (event.target.closest && event.target.closest(INTERACTIVE)) return
      const selection = typeof window !== 'undefined' && window.getSelection ? window.getSelection() : null
      if (selection && String(selection).length) return
      const subject = subjectFromElement(event.target)
      if (!subject || subject.uuid !== this.active.uuid) return
      this.locked = true
      this.dock = null
    },

    /** Lets a chosen block go, and the bar falls back to the page. */
    unlock() {
      this.locked = false
      this.active = null
      this.dock = null
      this.mark(null)
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
      // findAnchor escapes the value; a hand-built selector breaks on an id
      // that is not a uuid, and every id here comes from JSON:API.
      const el = subject.el || (subject.uuid && findAnchor(document, { entity: subject.uuid }))
      const { el: _, ...rest } = subject
      const page = subject.uuid === (this.page || {}).uuid
      this.active = page ? null : Object.freeze(rest)
      // Chosen from the list is chosen outright, the same as clicking it.
      this.locked = !page
      this.dock = null
      this.mark(page ? null : el)
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  },
}
</script>
