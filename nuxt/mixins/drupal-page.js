import { versionFromQuery } from '~/lib/revisions'

/**
 * Puts the editor store at the revision and diff a shared URL asks for, so the
 * page a reader was sent is the page they are sent to. Called from asyncData,
 * before the page is fetched.
 *
 * @param {object} store - The Vuex store.
 * @param {object} route - The route being loaded.
 */
export const readEditorQuery = (store, route) => {
  if (!(store.$auth && store.$auth.loggedIn)) return
  const asked = versionFromQuery(route.query)
  if (asked) store.commit('setEditorVersion', asked)
  store.commit('setEditorCompare', Boolean(route.query.diff))
}

/**
 * What a page read from Drupal needs beside its data: the editor's operations,
 * a DruxtEntity that re-fetches on a revision switch, and a URL that stays the
 * record of the view. The page's asyncData returns `document` and `drupal`.
 */
export default {
  watch: {
    // The URL is the view's record. A navigation on the same page that drops
    // `revision` or `diff` from it puts the store back to what the URL says;
    // a change the pill made and wrote to the URL comes through unchanged.
    '$route.query'(query) {
      if (!this.drupal || !(this.$auth && this.$auth.loggedIn)) return
      const editor = this.$store.state.editor
      const version = versionFromQuery(query) || 'working-copy'
      if (version !== editor.version) this.$store.commit('setEditorVersion', version)
      const compare = Boolean(query.diff)
      if (compare !== editor.compare) this.$store.commit('setEditorCompare', compare)
    },
  },

  computed: {
    /** The page's Drupal node, for an editor's operations; none for markdown. */
    operationsEntity() {
      if (!this.drupal || !this.document.uuid) return null
      return { type: this.document.type, id: this.document.uuid, attributes: { title: this.document.title }, state: this.document.moderationState }
    },
    /** Re-mounts DruxtEntity when the editor switches revision, so it re-fetches. */
    druxtKey() {
      const version = this.$auth && this.$auth.loggedIn ? this.$store.state.editor.version : 'published'
      return `${(this.document || {}).uuid}@${version}`
    },
  },
}
