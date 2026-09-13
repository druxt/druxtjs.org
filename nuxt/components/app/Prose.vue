<template>
  <div ref="prose" class="prose">
    <!--
      Keyed on the document path: enhance() rewrites the DOM NuxtContent
      renders, so each document needs a fresh subtree.
    -->
    <NuxtContent v-if="document" :key="document.path" :document="document" />
    <!-- Content rendered elsewhere, such as a Drupal page, keyed by the caller. -->
    <slot v-else />

    <!-- Lightbox for prose images, opened by the frames figures() adds.
         Mirrors AppFigure's own lightbox. -->
    <div
      v-if="zoom"
      ref="dialog"
      class="fixed inset-0 z-[80] bg-neutral/80 p-6 flex items-center justify-center cursor-[zoom-out]"
      role="dialog"
      aria-modal="true"
      :aria-label="zoom.alt ? 'Enlarged: ' + zoom.alt : 'Enlarged image'"
      @click.self="zoom = null"
      @keydown.tab="onTab"
    >
      <button
        type="button"
        class="absolute top-4 right-4 btn btn-sm btn-circle"
        aria-label="Close image"
        @click="zoom = null"
      >
        <span aria-hidden="true">&times;</span>
      </button>
      <img :src="zoom.src" :alt="zoom.alt" class="max-h-full max-w-full rounded-box shadow-2xl">
    </div>
  </div>
</template>

<script>
import { copyCodeEvent, languageFromClass } from '~/lib/analytics'
import { trapTab } from '~/utils/focus'

/**
 * NuxtContent with the module-page conventions applied.
 *
 * @nuxt/content v1 has no prose component overrides, so the rendered markdown
 * is enhanced after mount:
 *
 * - images become captioned, click-to-enlarge figures (alt text is the caption)
 * - code blocks get a copy button
 * - tables get a keyboard-reachable scroll region and per-cell column labels
 * - the "For more details, refer to the … API documentation" lines become buttons
 * - the `* * *` rules between sections are hidden
 */
export default {
  props: {
    // Null when the content comes through the slot.
    document: { type: Object, default: null },
  },

  /** The image currently enlarged, as { src, alt }; null when closed. */
  data: () => ({ zoom: null, restoreFocusTo: null }),

  watch: {
    document() {
      this.$nextTick(this.enhance)
    },

    zoom(open) {
      document.documentElement.style.overflow = open ? 'hidden' : ''

      if (open) {
        this.restoreFocusTo = document.activeElement
        this.$nextTick(() => {
          const close = this.$refs.dialog && this.$refs.dialog.querySelector('[aria-label="Close image"]')
          if (close) close.focus()
        })
        return
      }
      const target = this.restoreFocusTo
      this.restoreFocusTo = null
      if (target && document.contains(target)) this.$nextTick(() => target.focus())
    },

    $route() {
      this.zoom = null
    },
  },

  created() {
    // Plain property, not data: observers are not render state.
    this.tableObservers = []
  },

  mounted() {
    this.$nextTick(this.enhance)
    this.onKey = (e) => { if (e.key === 'Escape') this.zoom = null }
    window.addEventListener('keydown', this.onKey)

    // Druxt entities render after their own fetch, so content can land after
    // mount. Enhance it as it lands, and tell the diagram plugin.
    this.contentObserver = new MutationObserver(() => {
      clearTimeout(this.contentTimer)
      this.contentTimer = setTimeout(() => {
        this.contentObserver.disconnect()
        this.enhance()
        window.dispatchEvent(new Event('docs:content'))
        if (this.$refs.prose) this.contentObserver.observe(this.$refs.prose, { childList: true, subtree: true })
      }, 50)
    })
    this.contentObserver.observe(this.$refs.prose, { childList: true, subtree: true })
  },


  beforeDestroy() {
    this.contentObserver.disconnect()
    clearTimeout(this.contentTimer)
    window.removeEventListener('keydown', this.onKey)
    document.documentElement.style.overflow = ''
    this.disconnectTables()
  },


  methods: {
    onTab(e) {
      trapTab(this.$refs.dialog, e)
    },

    enhance() {
      const root = this.$refs.prose
      if (!root) return

      this.disconnectTables()
      this.figures(root)
      this.copyButtons(root)
      this.tables(root)
      root.querySelectorAll('hr').forEach((hr) => hr.setAttribute('data-decorative', ''))
    },

    figures(root) {
      root.querySelectorAll('img:not([data-enhanced])').forEach((img) => {
        img.setAttribute('data-enhanced', '')

        // Linked images (badges) navigate on click: no zoom figure.
        const link = img.closest('a')
        if (link) {
          link.style.borderBottom = 'none'
          return
        }

        const figure = document.createElement('figure')
        figure.className = 'docs-figure not-prose my-8'

        // A button, so the enlarge frame is reachable by keyboard and named
        // for screen readers.
        const frame = document.createElement('button')
        frame.type = 'button'
        frame.className = 'docs-figure-frame cursor-[zoom-in]'
        frame.setAttribute('aria-label', img.alt ? 'Enlarge: ' + img.alt : 'Enlarge image')
        frame.addEventListener('click', () => { this.zoom = { src: img.src, alt: img.alt } })

        img.parentNode.insertBefore(figure, img)
        frame.appendChild(img)
        figure.appendChild(frame)

        if (img.alt) {
          const caption = document.createElement('figcaption')
          caption.textContent = img.alt
          figure.appendChild(caption)
        }
      })
    },

    copyButtons(root) {
      root.querySelectorAll('pre:not([data-enhanced])').forEach((pre) => {
        pre.setAttribute('data-enhanced', '')
        // Focusable, so the scroll region is reachable and the copy button
        // appears where there is no hover.
        pre.tabIndex = 0

        // The button anchors to the wrapper, not the pre, so it does not
        // scroll away with the code.
        const wrapper = document.createElement('div')
        wrapper.className = 'docs-code'
        pre.parentNode.insertBefore(wrapper, pre)
        wrapper.appendChild(pre)

        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'docs-copy'
        // Named for screen readers; the visible text is a span so code.css
        // can reserve the wider "Copied" width behind it.
        button.setAttribute('aria-label', 'Copy code to clipboard')
        const label = document.createElement('span')
        label.textContent = 'Copy'
        button.appendChild(label)

        // A live region announces the result, so the button keeps its name.
        const status = document.createElement('span')
        status.className = 'sr-only'
        status.setAttribute('role', 'status')
        status.setAttribute('aria-live', 'polite')

        const code = pre.querySelector('code') || pre
        let timer
        const setState = (state, text, announce) => {
          clearTimeout(timer)
          label.textContent = text
          status.textContent = announce
          if (state) button.dataset.state = state
          else delete button.dataset.state
        }
        // navigator.clipboard is undefined on non-secure origins and can
        // reject, so the click is guarded.
        button.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(code.innerText)
            setState('copied', 'Copied', 'Copied to clipboard')
            // Only a successful copy is tracked.
            this.$track(...copyCodeEvent(
              this.$route.path,
              languageFromClass(pre.className) || languageFromClass(code.className),
            ))
          } catch (e) {
            setState('failed', 'Failed', 'Copy failed')
          }
          timer = setTimeout(() => setState(null, 'Copy', ''), 2000)
        })

        wrapper.appendChild(button)
        wrapper.appendChild(status)
      })
    },

    tables(root) {
      root.querySelectorAll('table:not([data-enhanced])').forEach((table) => {
        table.setAttribute('data-enhanced', '')

        // Column headings become data-label on every body cell; the stacked
        // layout in app.css prints them above each value below 640px.
        const headings = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent.trim())
        table.querySelectorAll('tbody tr').forEach((row) => {
          Array.from(row.children).forEach((cell, i) => {
            if (headings[i]) cell.setAttribute('data-label', headings[i])
          })
        })

        const wrapper = document.createElement('div')
        wrapper.className = 'docs-table'
        if (headings.length) wrapper.setAttribute('data-stack', '')

        const scroller = document.createElement('div')
        scroller.className = 'docs-table-scroll'
        scroller.setAttribute('role', 'region')
        scroller.setAttribute('aria-label', this.tableLabel(table, root))

        table.parentNode.insertBefore(wrapper, table)
        scroller.appendChild(table)
        wrapper.appendChild(scroller)

        // A scroll region is only a tab stop while it scrolls; the fade shows
        // only while there is more to the right.
        const update = () => {
          const overflow = scroller.scrollWidth > scroller.clientWidth + 1
          const atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 1
          wrapper.toggleAttribute('data-overflow', overflow && !atEnd)
          if (overflow) scroller.setAttribute('tabindex', '0')
          else scroller.removeAttribute('tabindex')
        }
        scroller.addEventListener('scroll', update, { passive: true })
        if (window.ResizeObserver) {
          const observer = new ResizeObserver(update)
          observer.observe(scroller)
          observer.observe(table)
          this.tableObservers.push(observer)
        }
        update()
      })
    },

    // The nearest heading above the table names its scroll region. Drupal
    // pages wrap each block, so a heading can sit inside an earlier sibling.
    tableLabel(table, root) {
      for (let node = table; node && node !== root; node = node.parentElement) {
        for (let prev = node.previousElementSibling; prev; prev = prev.previousElementSibling) {
          if (/^H[1-6]$/.test(prev.tagName)) return prev.textContent.trim()
          const headings = prev.querySelectorAll('h1, h2, h3, h4, h5, h6')
          if (headings.length) return headings[headings.length - 1].textContent.trim()
        }
      }
      return (this.document ? this.document.title : this.title) || 'Table'
    },

    disconnectTables() {
      this.tableObservers.forEach((observer) => observer.disconnect())
      this.tableObservers = []
    },

  },
}
</script>
