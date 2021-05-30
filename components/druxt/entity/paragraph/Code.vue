<template>
  <div class="my-8">
    <h3 v-if="title" class="mb-2 opacity-50 text-xl"># {{ title }}</h3>
    <div class="bg-black flex p-8 text-white">
      <code class="container mx-auto">
        {{ $attrs.entity.attributes.field_code }}
      </code>
    </div>
  </div>
</template>

<script>
export default {
  computed: {
    title: ({ $attrs }) => $attrs.entity.attributes.field_title,
  },
}
</script>
