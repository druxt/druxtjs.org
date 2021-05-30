<template>
  <p class="markdown" v-html="this.$md.render($attrs.value)" />
</template>

<style>
.markdown a {
  @apply text-blue-500 font-bold;
}

.markdown code {
  text-shadow: none;
  @apply bg-black flex p-8 text-white;
}

.markdown h2 {
  @apply text-size-2xl mb-4 mt-8;
}

.markdown h3 {
  @apply text-size-xl my-4;
}

.markdown p {
  @apply mb-4;
}

.markdown ul {
  @apply flex justify-center;
}

.markdown ul li {
  @apply mx-4;
}
</style>
