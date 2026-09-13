/**
 * The search shortcut label for the current platform.
 *
 * Shared by the header and the sidebar, which both advertise it. Client-side
 * only: it reads `navigator`, so components call it from `mounted()` and start
 * from the default below during SSR.
 */
export const MAC_SHORTCUT = '⌘K'

/**
 * @returns {string} `⌘K` on Apple platforms, `Ctrl K` everywhere else.
 */
export const searchShortcut = () => {
  // navigator.platform is deprecated; userAgentData is the replacement and
  // this falls back for browsers that don't implement it yet.
  const platform = (typeof navigator !== 'undefined'
    && (navigator.userAgentData?.platform || navigator.platform)) || ''
  return /Mac|iPod|iPhone|iPad/.test(platform) ? MAC_SHORTCUT : 'Ctrl K'
}
