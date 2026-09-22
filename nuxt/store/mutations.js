const RECENT_LIMIT = 5
const SEARCH_LIMIT = 5

export default {
  setModules(state, modules) {
    state.modules = modules
  },

  addMenuChildren(state, { children, parent }) {
    state.menu = state.menu.map((item) => (item.props && item.props.to === parent
      ? { ...item, children }
      : item))
  },

  addRecent(state, item) {
    state.recent = [item, ...state.recent.filter((o) => o.to !== item.to)].slice(0, RECENT_LIMIT)
  },

  /** The current document's table of contents, consumed by AppToc. */
  setToc(state, toc) {
    state.toc = toc || []
  },

  /** The revision the editor is viewing: 'published', 'working-copy' or 'id:<vid>'. */
  setEditorVersion(state, version) {
    state.editor = { ...state.editor, version: version || 'published' }
  },

  /** The current page's editor context: { uuid, nid, moderationState }. */
  setEditorPage(state, page) {
    state.editor = { ...state.editor, page: page || null }
  },

  /** The current page's revisions, from the backend's revision list. */
  setEditorRevisions(state, revisions) {
    state.editor = { ...state.editor, revisions: revisions || [] }
  },

  addRecentSearch(state, query) {
    const value = (query || '').trim()
    if (!value) return
    state.searches = [value, ...state.searches.filter((o) => o !== value)].slice(0, SEARCH_LIMIT)
  },

  /** Opens or closes the sign-in dialog. */
  setSignIn(state, open) {
    state.signIn = Boolean(open)
  },
}
