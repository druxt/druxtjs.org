<template>
  <div class="dropdown dropdown-end absolute top-0 right-0 z-10" data-druxt-operations>
    <button type="button" tabindex="0" class="btn btn-primary btn-square btn-sm shadow" :aria-label="`Edit ${label}`">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </button>
    <ul tabindex="0" class="dropdown-content menu mt-2 p-1 shadow-lg bg-base-100 border border-base-300 rounded-box w-44">
      <li v-for="operation of operations" :key="operation.key">
        <!-- target: a full page load, which content-links.client.js leaves alone. The page is Drupal's. -->
        <a :href="operation.href" target="_self" class="rounded-btn px-3 py-2 text-sm" :class="{ 'text-error': operation.key === 'delete-form' }">
          {{ operation.title }}
        </a>
      </li>
    </ul>
  </div>
</template>

<script>
/**
 * The operations Drupal offers the signed-in user on one entity.
 *
 * Mounted by the `v-druxt-admin` directive, never rendered on the server: a
 * reader's page carries none of this. Each link is a plain page load, because
 * Drupal's screens are served on this origin by the admin proxy.
 */
export default {
  props: {
    operations: { type: Array, required: true },
    label: { type: String, default: 'this page' },
  },
}
</script>
