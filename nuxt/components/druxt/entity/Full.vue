<script>
import DruxtEntityDefault from './Default.vue'

/** The full display mode, where an entity has no wrapper of its own: the same as default. */
export default {
  name: 'DruxtEntityFull',
  extends: DruxtEntityDefault,
  // Druxt reads a wrapper's own option, not the one it extends.
  druxt: DruxtEntityDefault.druxt,
}
</script>
