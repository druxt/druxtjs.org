<script>
import SectionDocument from '~/components/app/SectionDocument.vue'
import { ISSUES_PATH } from '~/utils/issues'

/**
 * The troubleshooting page, at its own URL and at each issue's.
 *
 * An issue's URL is a child route of this page, so opening and closing one
 * changes the URL without fetching the page again: Nuxt reruns a parent's
 * asyncData only when its own part of the path changes. Whichever URL a
 * reader arrives at, the page read is the troubleshooting page, never the
 * issue node the alias belongs to.
 */
export default {
  name: 'AppTroubleshootingDocument',
  extends: SectionDocument,
  asyncData(context) {
    return SectionDocument.asyncData({ ...context, route: { ...context.route, path: ISSUES_PATH } })
  },
}
</script>
