<template>
  <div :data-druxt-entity="(entity || {}).id || false" :data-druxt-type="(entity || {}).type" data-druxt-field="field_example">
    <DruxtExample v-if="link" :link="link" />
  </div>
</template>

<script>
import { parseExampleLink } from '~/utils/live-examples'

/** A live Druxt component in the page, set up from the playground link its editor pasted. */
export default {
  inheritAttrs: false,
  props: {
    entity: { type: Object, default: undefined },
  },
  computed: {
    /** The pasted link, when it names a live card; a broken one renders nothing rather than a broken card. */
    link: ({ entity }) => {
      const value = ((entity || {}).attributes || {}).field_example || ''
      return parseExampleLink(value) ? value : ''
    },
  },
}
</script>
