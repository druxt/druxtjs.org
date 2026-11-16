<template>
  <!--
    The front page is a Canvas page once Drupal has one at its path. It sits
    inside this element because a component that fetches cannot be the root of
    another that does: Nuxt keeps each one's fetch key on its root element.
  -->
  <div v-if="headless">
    <CanvasPage :path="headless.path" :page="headless.page" :session="headless.session" />
  </div>

  <div v-else-if="canvas">
    <DruxtCanvas :value="canvas" />
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
import CanvasPage from '~/modules/canvas-headless/CanvasPage'
import load from '~/modules/canvas-headless/load'
import layout from '~/modules/canvas-headless/layout'
import { FRONT_PATH, drawable, usesOwnComponents } from '~/modules/canvas-headless/front'
import { SITE_DESCRIPTION } from '~/lib/site'
import { seoHead } from '~/utils/seo'

const CANVAS_PAGE = 'canvas_page--canvas_page'
// Drupal's own front page stays its content list, which editors land on, so
// the front page's Canvas page has a path of its own there.
const CANVAS_PATH = FRONT_PATH

export default {
  components: { CanvasPage },

  layout: (context) => (context.$config.canvasHeadless ? layout(context) : 'default'),

  // With Canvas Headless on, the front page's Canvas page comes from Canvas's
  // content API, built from the site's own components, and Canvas's editor
  // frames this page to preview it. Without a Canvas page, the page below
  // renders either way. A Canvas page built from Drupal's components is left
  // to the JSON:API rendering, which draws those.
  async asyncData({ $config, req }) {
    if (!$config.canvasHeadless) return { headless: null }
    const { page, session } = await load(CANVAS_PATH, req).catch(() => ({}))
    return { headless: page && drawable(page.content) ? { path: CANVAS_PATH, page, session } : null }
  },

  data: () => ({
    // The front page's Canvas page, when Drupal has one that loads.
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
   * answer is an error, and the page below renders. It renders too when the
   * page itself does not load, which is why the page is fetched here and
   * handed to the component: the store answers a failure without rejecting.
   */
  async fetch() {
    if (this.headless) return
    try {
      const { route } = (await this.$store.dispatch('druxtRouter/get', CANVAS_PATH)) || {}
      const { type, uuid } = (route || {}).props || {}
      const resource = type === CANVAS_PAGE ? await this.$store.dispatch('druxt/getResource', { type, id: uuid }) : null
      const page = (resource || {}).data || null
      // A page built from the site's own components is drawn from the content
      // API's tree, with Canvas Headless on. Without it, the page below renders.
      this.canvas = page && !usesOwnComponents(page) ? page : null
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
