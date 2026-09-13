<script>
import DruxtEntityDefault from '../entity/Default.vue'

/**
 * The default form wrapper: DruxtEntityForm looks for its own names, and the
 * default entity wrapper already renders a form when the schema is one.
 */
export default {
  name: 'DruxtEntityFormDefault',
  extends: DruxtEntityDefault,
}
</script>
