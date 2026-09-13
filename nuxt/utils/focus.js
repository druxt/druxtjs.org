/**
 * Focus helpers shared by the two modal overlays: the navigation drawer and
 * the search dialog.
 *
 * Both declare themselves modal, so Tab must not leave them.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * The tabbable elements inside a container, in document order.
 *
 * Anything not rendered is filtered out: hidden elements report no client rects.
 *
 * @param {HTMLElement} container - Element to search within.
 * @returns {HTMLElement[]} The focusable descendants that are actually visible.
 */
export const focusable = (container) => (container
  ? Array.from(container.querySelectorAll(FOCUSABLE)).filter((el) => el.getClientRects().length)
  : [])

/**
 * Keep Tab and Shift+Tab cycling inside a container.
 *
 * Call from a keydown handler while the overlay is open. Returns without
 * touching the event for any other key, so the caller can keep its own
 * Escape and shortcut handling.
 *
 * @param {HTMLElement} container - The overlay element to trap focus within.
 * @param {KeyboardEvent} event - The keydown event being handled.
 * @returns {void}
 */
export const trapTab = (container, event) => {
  if (event.key !== 'Tab') return
  const items = focusable(container)
  if (!items.length) return

  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement

  // Focus outside the overlay would let the first Tab escape, so pull it in.
  if (!container.contains(active)) {
    event.preventDefault()
    first.focus()
    return
  }

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
