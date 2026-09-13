<template>
  <ul class="space-y-2 text-sm font-medium">
    <li v-for="item in items" :key="item.entity.id">
      <a :href="item.entity.attributes.url" class="text-primary-focus hover:underline">{{ item.entity.attributes.title }}</a>
      <ul v-if="item.children && item.children.length" class="mt-2 ml-4 pl-4 border-l border-base-300 space-y-2">
        <li v-for="child in item.children" :key="child.entity.id">
          <a :href="child.entity.attributes.url" class="text-primary-focus hover:underline">{{ child.entity.attributes.title }}</a>
        </li>
      </ul>
    </li>
    <li v-if="!items.length" class="text-base-content/70 font-normal">This menu has no links.</li>
  </ul>
</template>

<script>
/**
 * The default menu wrapper: a flat list of links, children indented behind
 * a rule, no bullets. Catches any menu with no wrapper of its own.
 */
export default {
  props: {
    items: { type: Array, default: () => [] },
  },
}
</script>
