<script>
/**
 * Every field without a more specific wrapper: its label when shown above,
 * then each item, rendered by DruxtField's own item slots.
 */
export default {
  props: {
    errors: { type: Array, default: () => [] },
    relationship: { type: Boolean, default: false },
    schema: { type: Object, default: () => ({}) },
    value: { type: [Array, Boolean, Number, Object, String], default: undefined },
  },
  render(h) {
    const slots = this.$scopedSlots
    const items = Object.keys(slots)
      .filter((name) => /^field-\d+$/.test(name))
      .sort((a, b) => a.split('-')[1] - b.split('-')[1])
    const label = slots['label-above'] ? [slots['label-above']()] : []
    return h('div', [...label, ...items.map((name) => slots[name]())])
  },
}
</script>
