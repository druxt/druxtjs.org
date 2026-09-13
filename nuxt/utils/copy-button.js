/** What the copy button says, per state; no state is "Copy". */
export const COPY_STATES = {
  copied: { label: 'Copied', announce: 'Copied to clipboard' },
  failed: { label: 'Failed', announce: 'Copy failed' },
}

/**
 * Copy text, and say how it went.
 *
 * navigator.clipboard is undefined on non-secure origins and can reject, so
 * the failure is a state, not an exception.
 *
 * @param {string} text - What to copy.
 * @returns {Promise<'copied'|'failed'>} The state the button should show.
 */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch (e) {
    return 'failed'
  }
}

/**
 * The docs' copy button, on a code block Vue does not re-render: prose.
 * A live component renders the same control from its template instead,
 * because this moves the `pre` under a node Vue does not know about.
 *
 * Wraps the `pre` in `.docs-code` so the button anchors to the wrapper and
 * does not scroll away with the code. Enhances a block once.
 *
 * @param {HTMLPreElement} pre - The code block.
 * @param {object} [options]
 * @param {Function} [options.onCopy] - Called after a successful copy.
 */
export function addCopyButton(pre, { onCopy } = {}) {
  if (!pre || pre.hasAttribute('data-enhanced')) return
  pre.setAttribute('data-enhanced', '')
  // Focusable, so the scroll region is reachable and the copy button
  // appears where there is no hover.
  pre.tabIndex = 0

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
  button.addEventListener('click', async () => {
    const state = await copyText(code.innerText)
    setState(state, COPY_STATES[state].label, COPY_STATES[state].announce)
    if (state === 'copied' && onCopy) onCopy()
    timer = setTimeout(() => setState(null, 'Copy', ''), 2000)
  })

  wrapper.appendChild(button)
  wrapper.appendChild(status)
}
