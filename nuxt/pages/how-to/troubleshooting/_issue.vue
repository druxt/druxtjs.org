<script>
import { seoHead } from '~/utils/seo'
import { ISSUE_TYPE, ISSUES_PATH, onIssuesPage, storedIssue } from '~/utils/issues'

/** What the page's head needs from an issue. */
const issueOf = (attributes = {}) => ({ title: attributes.title || '', description: attributes.field_description || '' })

/**
 * The troubleshooting page with one issue open: the issue's URL.
 *
 * It renders nothing; the Issues list opens the issue the route names. It
 * gives the page the issue's title and summary, answers 404 for a slug no
 * issue has, and follows Drupal's redirect from a renamed issue's old URL.
 *
 * Opening an issue from the list finds it among the issues the list
 * loaded, so the route changes at once and Nuxt's loading bar, which waits
 * a moment before it shows, never does. The page keeps that bar rather
 * than setting `loading: false`, which Nuxt reads after starting the bar
 * and which then stops it from finishing.
 */
export default {
  async asyncData({ error, from, params, redirect, route, store }) {
    const path = `${ISSUES_PATH}/${params.issue}`
    const listed = process.client && from && onIssuesPage(from.path) && storedIssue(store.state.druxt, path)
    if (listed) return { issue: issueOf(listed) }

    const { route: found, redirect: moved } = (await store.dispatch('druxtRouter/get', path)) || {}
    if (moved) return redirect(301, moved, route.query)
    const entity = found && !found.error && found.entity
    if (!entity || entity.type !== 'node' || entity.bundle !== 'docs_issue') {
      return error({ statusCode: 404, message: 'Issue not found' })
    }
    const resource = await store.dispatch('druxt/getResource', { type: ISSUE_TYPE, id: entity.uuid })
    return { issue: issueOf(((resource && (resource.data || resource)) || {}).attributes) }
  },
  head() {
    return seoHead({ title: this.issue.title, description: this.issue.description, path: this.$route.path })
  },
  render: () => null,
}
</script>
