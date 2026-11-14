<template>
  <!--
    The front page is a Canvas page once Drupal has one at its path. It sits
    inside this element because a component that fetches cannot be the root of
    another that does: Nuxt keeps each one's fetch key on its root element.
  -->
  <div v-if="canvas">
    <DruxtCanvas :uuid="canvas" />
  </div>

  <div v-else>
    <AppHomeHero
      :heading="slogan"
      lead="Druxt is a framework for building fully decoupled Drupal and Nuxt.js applications and sites."
      note="Built on the Nuxt 2 / Vue 2 line: see"
      note-link-text="support and versioning"
      note-link-url="/explanation/support-and-versioning"
    >
      <template #actions>
        <AppHomeAction label="Get started" url="/tutorials/getting-started" variant="primary" icon="tutorials" />
        <AppHomeAction label="Browse modules" url="/modules" icon="modules" />
        <AppHomeAction label="Try the playground" url="/playground" icon="playground" />
      </template>
      <AppHomeQuickstartCommand />
    </AppHomeHero>

    <AppHomeFeatures>
      <AppHomeFeature v-for="feature of features" :key="feature.heading" v-bind="feature" />
    </AppHomeFeatures>

    <AppHomeShowcase
      heading="Built with Druxt"
      text="Four reference apps run against the same Drupal Umami demo content. The smallest is an eleven page pattern index. The largest is the Content Ops Console, above."
      detail="Every edit it makes is an authenticated OAuth2 write back through JSON:API, and it filters for content with fields still missing."
      link-text="Explore the example apps"
      link-url="/how-to/example-apps"
      image-src="/images/examples-content-ops-console.png"
      image-alt="Content Ops Console: a dark sidebar and a dense editorial table with inline difficulty and prep time editing"
    />

    <AppHomeModules
      heading="Modules"
      text="Adopt the whole framework, or only the parts you need."
      link-text="All modules"
      link-url="/modules"
    />
  </div>
</template>

<script>
import { SITE_DESCRIPTION } from '~/lib/site'
import { seoHead } from '~/utils/seo'

const CANVAS_PAGE = 'canvas_page--canvas_page'
// The Drupal path of the front page's Canvas page. Drupal's own front page
// stays its content list, which editors land on.
const CANVAS_PATH = '/home'

export default {
  data: () => ({
    // The uuid of the front page's Canvas page, when there is one.
    canvas: null,
    slogan: 'The Fully Decoupled Drupal Framework',
    features: [
      {
        icon: 'api',
        heading: 'JSON:API client and store',
        text: 'A JSON:API client and Vuex store modules keep Drupal entities, resources and relationships in sync on the frontend.',
      },
      {
        icon: 'modules',
        heading: 'Themeable Vue components',
        text: 'The DruxtWrapper pattern lets you override any component, down to a single field, without forking the library.',
      },
      {
        icon: 'globe',
        heading: 'Multilingual and proxy support',
        text: 'A langcode-aware client, store and components, plus a request proxy. Translated routes need one backend patch.',
      },
      {
        icon: 'lock',
        heading: 'OAuth2 login flows',
        text: 'druxt-auth handles Authorization Code with PKCE, token storage and authenticated requests.',
        linkUrl: '/tutorials/authentication',
        linkText: 'Add a login flow.',
      },
    ],
  }),

  /**
   * Asks Drupal for the Canvas page. Until one is published at its path, the
   * answer is an error, and the page below renders.
   */
  async fetch() {
    try {
      const { route } = (await this.$store.dispatch('druxtRouter/get', CANVAS_PATH)) || {}
      const { type, uuid } = (route || {}).props || {}
      this.canvas = type === CANVAS_PAGE ? uuid : null
    } catch (e) {
      this.canvas = null
    }
  },

  head() {
    return {
      // The homepage sets its own title: the site-wide suffix would repeat the name.
      // A Canvas page's own title and description are not read: it lives at
      // another path, and the front page's head stays the site's.
      titleTemplate: 'DruxtJS - The Fully Decoupled Drupal Framework',
      ...seoHead({
        title: null,
        description: SITE_DESCRIPTION,
        path: '/',
        type: 'website',
      }),
    }
  },
}
</script>
