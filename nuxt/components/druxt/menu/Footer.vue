<template>
  <!-- Two columns: the site's own pages, then the outside links. -->
  <div class="grid gap-8 sm:grid-cols-2">
    <nav v-if="docs.length" aria-labelledby="footer-docs">
      <h2 id="footer-docs" class="text-xs font-semibold uppercase tracking-wider text-base-content/70">
        Documentation
      </h2>
      <ul class="mt-3 space-y-2 text-sm">
        <li v-for="link of docs" :key="link.url">
          <NuxtLink class="text-primary-focus hover:underline" :to="link.url">{{ link.text }}</NuxtLink>
        </li>
      </ul>
    </nav>

    <nav v-if="community.length" aria-labelledby="footer-community">
      <h2 id="footer-community" class="text-xs font-semibold uppercase tracking-wider text-base-content/70">
        Community
      </h2>
      <ul class="mt-3 space-y-2 text-sm">
        <li v-for="link of community" :key="link.url">
          <a class="text-primary-focus hover:underline" :href="link.url" target="_blank" rel="noopener">{{ link.text }}</a>
        </li>
      </ul>
    </nav>
  </div>
</template>

<script>
/** The footer menu, from Drupal: its site links, then its outside links. */
export default {
  props: {
    items: { type: Array, default: () => [] },
  },
  computed: {
    links: ({ items }) => items.map(({ entity }) => ({ text: entity.attributes.title, url: entity.attributes.url })),
    docs: ({ links }) => links.filter((link) => !/^https?:\/\//.test(link.url)),
    community: ({ links }) => links.filter((link) => /^https?:\/\//.test(link.url)),
  },
}
</script>
