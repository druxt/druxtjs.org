<template>
  <AppHomeFeatures><slot name="items" /></AppHomeFeatures>
</template>

<script>
import { DruxtCanvasComponentMixin } from '@druxt-contrib/canvas'

export default {
  mixins: [DruxtCanvasComponentMixin],

}
</script>
