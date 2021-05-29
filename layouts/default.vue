<template>
  <div class="h-full flex flex-col">
    <header
      class="bg-white dark:bg-gray-900 border-b flex p-4 sticky top-0 z-50"
    >
      <NuxtLink class="flex" to="/">
        <Logo class="h-5 mr-4" />
        DruxtJS
      </NuxtLink>
      <DruxtMenu class="ml-auto">
        <template #default="{ items }">
          <ul class="flex">
            <li v-for="item of items" class="mr-4" :key="item.entity.id">
              <NuxtLink
                v-if="item.entity.attributes.url.startsWith('/')"
                class="text-blue-500"
                :to="item.entity.attributes.url"
              >
                {{ item.entity.attributes.title }}
              </NuxtLink>

              <a
                v-else
                class="text-blue-500"
                :href="item.entity.attributes.url"
              >
                {{ item.entity.attributes.title }}
              </a>
            </li>
          </ul>
        </template>
      </DruxtMenu>
    </header>

    <main class="relative flex-grow">
      <Nuxt keep-alive />
    </main>
  </div>
</template>

<style>
html,
body,
#__nuxt,
#__layout {
  @apply h-full;
}

body {
  @apply bg-white dark:bg-gray-900 dark:text-white;
}
</style>
