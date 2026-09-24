import { queryFor } from '~/lib/revisions'

/**
 * The view an editor is reading, carried in the URL so they can send it to
 * someone: `?revision=` and `?diff=1`.
 *
 * Whatever changes the view writes the URL before anything re-fetches, because
 * the page reads the query on the way back in: a refresh that ran first would
 * read the URL as it was and undo the change.
 */
export default {
  methods: {
    /**
     * Replaces the URL's revision and diff with what the store now holds.
     *
     * Awaited by its callers: the router changes the route on its own tick,
     * and a re-fetch that ran first would read the URL as it was.
     *
     * @returns {Promise<void>} When the URL is the one the store describes.
     */
    async carryRevisionInUrl() {
      const editor = (this.$store || {}).state.editor
      if (!editor || !(this.$auth && this.$auth.loggedIn)) return
      const { revision, diff, ...rest } = this.$route.query
      const next = { ...rest, ...queryFor(editor.version, editor.compare) }
      if (JSON.stringify(next) === JSON.stringify(this.$route.query)) return
      try {
        // Replaced, not pushed: the same page, not a place to go back to.
        await this.$router.replace({ path: this.$route.path, query: next })
      } catch (e) {
        // A navigation the router cancelled is not the reader's problem.
      }
    },
  },
}
