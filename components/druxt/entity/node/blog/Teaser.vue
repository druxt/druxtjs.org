<template>
  <NuxtLink
    :to="$attrs.entity.attributes.path.alias"
    class="
      bg-center bg-cover bg-gradient-to-bl
      flex flex-col
      from-green-500
      justify-end
      my-4
      opacity-90
      rounded-sm
      text-white
      to-blue-500
      w-full
    "
    :style="{ backgroundImage: src ? `url(${src})` : false }"
  >
    <div class="bg-gradient-to-t from-black p-4 rounded-sm to-transparent">
      <div class="mx-auto">
        <h2 class="bg-black bg-opacity-50 inline-block px-2 py-1 text-size-2xl">
          {{ $attrs.entity.attributes.title }}
        </h2>
        <div>
          <p
            class="
              bg-black bg-opacity-40
              inline-block
              ml-2
              mt-1
              px-2
              py-1
              text-sm
            "
            v-html="changed"
          />
        </div>
        <div>
          <p
            class="bg-black bg-opacity-40 inline-block my-4 px-2 py-1"
            v-html="$attrs.entity.attributes.field_description.processed"
          />
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script>
import Default from './Default.vue'

export default {
  extends: Default,
}
</script>
