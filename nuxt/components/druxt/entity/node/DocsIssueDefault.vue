<script>
import DocPageFull from './DocPageFull.vue'

/**
 * A troubleshooting issue's fix: its blocks, read the way a page's body is,
 * at the revision a signed-in editor has chosen.
 *
 * Only the troubleshooting page's Issues list renders it. An issue has no
 * page of its own, so its title and summary are the list's, not this.
 */
export default {
  extends: DocPageFull,
}
</script>
