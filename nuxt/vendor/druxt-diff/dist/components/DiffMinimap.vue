<template>
  <!--
    Nothing on the server, where there is no page to measure, and nothing
    when there is nothing to point at: an empty rail is furniture.
  -->
  <nav
    v-if="ready && marks.length"
    class="diff-minimap"
    :aria-label="label"
    data-testid="diff-minimap"
  >
    <!--
      Everything a site needs to draw its own rail: where each change sits down
      the page, where the reader is, and how to reach one. The default below is
      deliberately plain, because a module that ships a designed rail is a
      module every site has to undo.
    -->
    <slot :marks="marks" :viewport="viewport" :scroll-to="scrollTo">
      <span
        class="diff-minimap__viewport"
        :style="{ top: viewport.top + '%', height: viewport.height + '%' }"
        aria-hidden="true"
      />
      <button
        v-for="mark of marks"
        :key="mark.key"
        type="button"
        class="diff-minimap__mark"
        :class="`diff-minimap__mark--${mark.status}`"
        :style="{ top: mark.top + '%', height: mark.height + '%' }"
        :data-status="mark.status"
        @click="scrollTo(mark)"
      >
        <span class="diff-minimap__name">{{ mark.name }}</span>
      </button>
    </slot>
  </nav>
</template>

<script>

// The package by name, not a relative path: siroc bundles the engine into
// `dist/index.*` and mkdist transpiles components into `dist/components`, so
// `../lib/minimap` does not exist once built.
import { anchorUuid, placeMarks, placeViewport } from '@druxt-contrib/diff'

/** The changes worth pointing at. A block that did not change is not one. */
const MARKED = ['changed', 'added', 'removed', 'moved']

/**
 * Where the changes are on a long page, down the edge of it.
 *
 * A reader comparing a page cannot see a change three screens away. This
 * marks each one at its place in the page, the way an editor marks changed
 * lines beside its scrollbar, and takes the reader to it.
 *
 * Positions are measurements, so they live here rather than in the engine,
 * which holds no DOM. Each block is found through the anchor its wrapper
 * wrote, for the side the page renders.
 */
export default {
  name: 'DruxtDiffMinimap',

  props: {
    /** The blocks from `normaliseDiff()`. */
    blocks: {
      type: Array,
      default: () => [],
    },

    /** The side the page renders, which is the uuid to look for. */
    side: {
      type: String,
      default: 'right',
    },

    /** Which statuses are marked. */
    statuses: {
      type: Array,
      default: () => MARKED,
    },

    /**
     * How a block's uuid becomes an element. The default reads the anchor
     * `@druxt-contrib/anchors` writes, which is what a Druxt field wrapper
     * renders; a site that anchors its blocks another way passes its own.
     */
    resolve: {
      type: Function,
      default: null,
    },

    /** What a reader hears the rail called. */
    label: {
      type: String,
      default: 'Changes on this page',
    },

    /**
     * What a reader hears a mark called, given the mark and its place in the
     * list. A site with titles for its blocks says something better than the
     * status.
     */
    name: {
      type: Function,
      default: null,
    },

    /**
     * The element the page scrolls, for a site that scrolls a panel rather
     * than the document.
     */
    container: {
      type: null,
      default: null,
    },

    /** How a mark scrolls into view, passed to `scrollIntoView`. */
    scrollOptions: {
      type: Object,
      default: () => ({ behavior: 'smooth', block: 'center' }),
    },
  },

  data: () => ({ ready: false, marks: [], viewport: { top: 0, height: 0 } }),

  watch: {
    blocks: {
      handler() {
        this.$nextTick(this.measure)
      },
      deep: true,
    },
    side() {
      this.$nextTick(this.measure)
    },
  },

  mounted() {
    this.ready = true
    this.onChange = () => this.measure()
    window.addEventListener('resize', this.onChange)
    window.addEventListener('scroll', this.onChange, { passive: true })
    // The page settles after the diff arrives, so measure once it has.
    this.$nextTick(this.measure)
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.onChange)
    window.removeEventListener('scroll', this.onChange)
  },

  methods: {
    /** The element a block is rendered in, or null while it is not. */
    elementFor(block) {
      const uuid = anchorUuid(block, this.side)
      if (!uuid) return null
      if (this.resolve) return this.resolve(uuid, block)
      return document.querySelector(`[data-druxt-entity="${uuid}"]`)
    },

    /** The element the page scrolls, and what it scrolls by. */
    scroller() {
      return (
        this.container || document.scrollingElement || document.documentElement
      )
    },

    /** Measures every marked block that is on the page, and where the reader is. */
    measure() {
      const scroller = this.scroller()
      if (!scroller) return
      const total = scroller.scrollHeight || 0
      const scrolled = this.container
        ? this.container.scrollTop
        : window.scrollY
      const origin = this.container
        ? this.container.getBoundingClientRect().top - this.container.scrollTop
        : 0

      const found = []
      for (const block of this.blocks || []) {
        if (!this.statuses.includes(block.status)) continue
        const el = this.elementFor(block)
        if (!el) continue
        const box = el.getBoundingClientRect()
        found.push({
          block,
          el,
          top: box.top - origin + scrolled,
          height: box.height,
        })
      }

      const placed = placeMarks(found, total)
      this.marks = found.map((item, index) => ({
        key: anchorUuid(item.block, this.side) || String(index),
        status: item.block.status,
        block: item.block,
        el: item.el,
        name: this.name
          ? this.name(item.block, index, found.length)
          : `${item.block.status} block, ${index + 1} of ${found.length}`,
        ...placed[index],
      }))

      const shown = this.container
        ? this.container.clientHeight
        : window.innerHeight
      this.viewport = placeViewport(scrolled, shown, total)
    },

    /**
     * Takes the reader to a change.
     *
     * @param {object} mark - The mark to go to.
     */
    scrollTo(mark) {
      if (mark && mark.el && mark.el.scrollIntoView) {
        mark.el.scrollIntoView(this.scrollOptions)
      }
      this.$emit('go', mark)
    },
  },
}
</script>

<style>
/* Geometry, and a width per status so the marks differ by more than colour.
   Colour is the site's: these use currentColor and it says the rest. */
.diff-minimap {
  position: fixed;
  top: 15vh;
  right: 0.25rem;
  bottom: 15vh;
  width: 0.625rem;
  z-index: 20;
}
.diff-minimap__viewport {
  position: absolute;
  left: 0;
  right: 0;
  min-height: 2%;
  border-radius: 3px;
  background: currentColor;
  opacity: 0.1;
}
.diff-minimap__mark {
  position: absolute;
  right: 0;
  width: 100%;
  min-height: 4px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: currentColor;
  cursor: pointer;
}
.diff-minimap__mark--removed {
  width: 55%;
}
.diff-minimap__mark--moved {
  width: 75%;
}
.diff-minimap__name {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
