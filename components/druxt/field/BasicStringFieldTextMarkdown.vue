<template>
  <p class="markdown" v-html="this.$md.render($attrs.value)" />
</template>

<style>
.markdown a {
  @apply text-blue-500 font-bold;
}

.markdown ul {
  @apply flex justify-center;
}

.markdown ul li {
  @apply mx-4;
}
</style>
