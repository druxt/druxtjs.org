<template>
  <div class="container mx-auto mt-25">
    <h1 class="mb-10 text-3xl">DruxtJS Blog</h1>

    <DruxtEntity
      v-for="result of $attrs.results"
      class="flex"
      :key="result.id"
      :mode="$attrs.display.display_options.row.options.view_mode"
      :type="result.type"
      :uuid="result.id"
    >
      {{ result.attributes.title }}
    </DruxtEntity>
  </div>
</template>
