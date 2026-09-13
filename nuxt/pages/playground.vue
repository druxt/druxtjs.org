<template>
  <div>
    <h1 class="text-3xl font-semibold tracking-tight mb-2">Live component playground</h1>
    <p class="text-base-content/70 mb-8 max-w-content">
      Pick a Druxt component and render it against a live Drupal: this site's, the Umami demo, or
      your own. Its props are the controls and its examples are presets.
    </p>

    <DruxtExample />

    <div class="mt-8 space-y-4 text-sm text-base-content/70 max-w-content">
      <p>
        Every change re-renders the component above. The requests list shows what it asked Drupal
        for, and the markup line is what you copy into your own site. Components marked as rendered
        by a parent, or as shipped wrappers, appear inside the component that owns them.
      </p>
      <p>
        To use your own Drupal, choose it in the backend list and paste its origin. The browser
        talks to it directly, as an anonymous visitor, so it has to serve JSON:API and allow this
        origin with CORS in its <code>services.yml</code>. DruxtRouter needs Decoupled Router,
        DruxtMenu needs JSON:API Menu Items and DruxtView needs JSON:API Views. What your Drupal
        lacks greys out the components that need it. Nothing you paste is stored and the page only
        reads, but a site that is not meant to be public does not belong on this page.
      </p>
      <p>
        What renders depends on the wrapper components in front of the backend. This site ships
        wrappers for its own pages, blocks, menus and views, so its content comes out themed. The
        Umami demo and your own Drupal render through Druxt's default output, which is plain on
        purpose: a list of fields for an entity, or a plain list for a menu. That is the starting
        point a wrapper component builds on.
        <NuxtLink to="/how-to/theming" class="link">Theming</NuxtLink> shows how.
      </p>
    </div>
  </div>
</template>

<script>
import { PLAYGROUND_DESCRIPTION } from '~/lib/site'
import { seoHead } from '~/utils/seo'

export default {
  name: 'PlaygroundPage',
  head() {
    // The tab names the component a shared link opens on; the share card stays the page's.
    const component = this.$route.query.component
    return seoHead({
      title: component ? `${component} in the playground` : 'Live component playground',
      description: PLAYGROUND_DESCRIPTION,
      // The query string carries a card's state; the page is one page.
      path: '/playground',
      type: 'website',
    })
  },
}
</script>
