import Vue from 'vue'

// The SDK's session element: it runs the renewal protocol and reports
// geometry and height to the editor.
const ELEMENT = 'canvas-draft-session'
Vue.config.ignoredElements = [...Vue.config.ignoredElements, ELEMENT]

/**
 * Canvas's editor waits for the page it frames to report its draft session,
 * and a page this module does not draw has no session element to do so: a
 * page built from other components, or one that is not found. In a frame,
 * such a page is given the element, so the editor is answered whatever the
 * page turned out to be.
 */
const ensureSession = async () => {
  if (document.querySelector(ELEMENT)) return
  const session = await fetch('/api/draft/session', { credentials: 'same-origin' })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
  if (!session || !session.enabled || document.querySelector(ELEMENT)) return

  const element = document.createElement(ELEMENT)
  const attributes = {
    'token-expires-at': session.tokenExpiresAt,
    'initial-expired': session.expired ? '' : null,
    'renew-url': session.renewUrl,
    'editor-origin': session.editorOrigin,
    'renew-endpoint': '/api/draft/renew',
    path: window.location.pathname + window.location.search,
  }
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== null && value !== undefined) element.setAttribute(name, value)
  }
  element.dataset.added = ''
  document.body.prepend(element)

  if (!customElements.get(ELEMENT) && !document.querySelector('script[src="/_canvas-headless/client.js"]')) {
    const script = document.createElement('script')
    script.src = '/_canvas-headless/client.js'
    document.head.appendChild(script)
  }
}

export default ({ app }) => {
  if (!process.client || window.self === window.top) return
  // After the page has rendered, so one that brings its own element keeps it.
  const later = () => setTimeout(ensureSession, 300)
  window.onNuxtReady(later)
  app.router.afterEach(() => {
    for (const added of document.querySelectorAll(`${ELEMENT}[data-added]`)) added.remove()
    later()
  })
}
