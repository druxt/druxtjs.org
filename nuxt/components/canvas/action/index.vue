<template>
  <AppHomeAction :label="label" :url="url" :variant="variant" />
</template>

<script>
export default {
  props: {
    label: { type: String, default: '' },
    url: { type: String, default: '/' },
    variant: { type: String, default: 'ghost' },
  },
}
</script>
