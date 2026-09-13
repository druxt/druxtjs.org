<template>
  <div>
    <h1 class="text-3xl font-semibold tracking-tight mb-2">Live component playground</h1>
    <p class="text-base-content/70 mb-8 max-w-content">
      Pick a Druxt component and render it against a live Drupal. Its props are the controls;
      its examples are presets.
    </p>

    <DruxtExample />

    <p class="text-sm text-base-content/70">
      Every change re-renders the component above. The markup line is what you copy into your own
      site. Components marked as rendered by a parent, or as shipped wrappers, appear inside the
      component that owns them.
    </p>
  </div>
</template>

<script>
import { PLAYGROUND_DESCRIPTION } from '~/lib/site'
import { seoHead } from '~/utils/seo'

export default {
  name: 'PlaygroundPage',
  head() {
    return seoHead({
      title: 'Live component playground',
      description: PLAYGROUND_DESCRIPTION,
      // The query string carries a card's state; the page is one page.
      path: '/playground',
      type: 'website',
    })
  },
}
</script>
