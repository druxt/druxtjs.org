// GA4, as a plain gtag.js snippet: the Nuxt analytics modules need either
// Universal Analytics or Nuxt 3.
const GA_MEASUREMENT_ID = 'G-Y1ZRHGDGSD'
const { backendOrigin, serviceRoute } = require('./server/backend')
const { AUTH_COOKIE_PREFIX, AUTH_STRATEGY } = require('./lib/auth')
const { syncDruxtComponents } = require('./lib/sync-druxt-components')

// The id is interpolated into an inline script, so check its shape first.
if (!/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)) {
  throw new Error('GA_MEASUREMENT_ID must match G-[A-Z0-9]+')
}

// Lagoon sets this to 'production' for druxtjs.org itself and 'development'
// for preview builds, so previews never send hits to the real property.
const isProduction = process.env.LAGOON_ENVIRONMENT_TYPE === 'production'

// Routes generate:routeFailed reported; generate:done refuses to ship them.
const failedRoutes = []

import { SITE_NAME, SITE_DESCRIPTION, SITE_ORIGIN, docTypeExpression } from './lib/site'
import { isTrackableHostname } from './lib/analytics'

/** The installed `druxt` version, shown in the header badge. Read from disk: its `exports` hides package.json. */
const druxtVersion = JSON.parse(
  require('fs').readFileSync(require('path').join(__dirname, 'node_modules', 'druxt', 'package.json'), 'utf8'),
).version

/** The Drupal backend Druxt reads, and proxies onto this origin. */
const DRUXT_BASE_URL = process.env.DRUXT_BASE_URL || 'http://127.0.0.1:8899'

/** The consumer this site is to Drupal: its decoupled settings and its OAuth client. */
const CONSUMER_ID = process.env.DRUXT_CONSUMER_ID || 'druxtjs_org'

/**
 * Editor sign-in: the authorization code grant with PKCE, as a public client.
 * The authorize step is a browser redirect, so it names the origin a browser
 * reaches Drupal on; the token exchange and the user lookup go through this
 * origin's proxy. druxt-auth builds both on the server's base URL, which is
 * an internal service name in production, so the strategy is set here.
 */
const OAUTH_CLIENT = { clientId: CONSUMER_ID, scope: ['editor'] }
const OAUTH_STRATEGY = {
  scheme: 'oauth2',
  endpoints: {
    authorization: backendOrigin(process.env) + '/oauth/authorize',
    token: '/oauth/token',
    userInfo: '/oauth/userinfo',
  },
  ...OAUTH_CLIENT,
  responseType: 'code',
  grantType: 'authorization_code',
  codeChallengeMethod: 'S256',
}

export default {
  // Pages render live from Drupal. In production, server/start.js serves
  // pre-rendered copies first and falls back to live rendering.
  target: 'server',

  publicRuntimeConfig: {
    druxtVersion,
    // "markdown" reads the authored pages from content/ instead of Drupal.
    docsSource: process.env.DOCS_SOURCE || 'drupal',
    // The environment's Storybook, when it has one: linked from the footer and the playground.
    storybookUrl: serviceRoute(process.env.LAGOON_ROUTES, 'storybook') || process.env.STORYBOOK_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3030'),
  },

  head: {
    titleTemplate: '%s - DruxtJS',
    htmlAttrs: { lang: 'en' },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '' },
      { name: 'format-detection', content: 'telephone=no' },
    ],
    // static/ ships icon.png, from which @nuxtjs/pwa generates the rest of
    // the icon set, and favicon.ico for the consumers that ask for one by
    // name.
    link: [{ rel: 'icon', type: 'image/png', href: '/icon.png' }],
    script: [
      // Sets data-theme before first paint, from the stored or OS preference.
      // plugins/color-mode-theme.client.js keeps it in sync after that.
      {
        hid: 'druxt-theme-init',
        innerHTML: "(function(){try{var k='druxt-color-mode';var p=localStorage.getItem(k)||'system';var v=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.setAttribute('data-theme',v)}catch(e){}})()",
        pbody: true,
      },
      // vue-meta re-runs this script on every client-side navigation, so each
      // page re-fires gtag('config'); adding a page_view plugin double-counts.
      // The hostname gate keeps Lagoon's own routes out of the property: they
      // pass the environment check, but they are not the site.
      ...(isProduction ? [
        { hid: 'ga-src', src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`, async: true },
        {
          hid: 'ga-init',
          innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());if((${isTrackableHostname})(location.hostname)){gtag('config','${GA_MEASUREMENT_ID}',{doc_type:${docTypeExpression()}});}`,
        },
      ] : []),
    ],
    __dangerouslyDisableSanitizersByTagID: {
      'druxt-theme-init': ['innerHTML'],
      ...(isProduction ? { 'ga-init': ['innerHTML'] } : {}),
    },
  },

  css: ['~/assets/css/app.css', '~/assets/css/code.css'],
  plugins: [
    '~/plugins/color-mode-theme.client.js',
    '~/plugins/analytics.client.js',
    '~/plugins/chunk-reload.client.js',
    '~/plugins/content-links.client.js',
    '~/plugins/mermaid.client.js',
    // After the Druxt and auth plugins the modules add: it wraps the client.
    '~/plugins/working-copy.js',
  ],
  components: true,
  // Mirrors the SITE_ORIGIN override into the client bundle so hydration
  // recomputes the same absolute URLs the generated HTML carries.
  env: {
    SITE_ORIGIN,
  },

  buildModules: [
    '@nuxtjs/pwa',
    '@nuxtjs/tailwindcss',
    // Dark mode: follows the OS by default, remembers an explicit choice.
    '@nuxtjs/color-mode',
  ],

  // classSuffix: '' makes the class color-mode sets match the daisyUI theme
  // names in tailwind.config.js.
  colorMode: {
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'druxt-color-mode',
  },

  pwa: {
    // No service worker: a cached docs site serves stale pages. enabled: false
    // also ships a worker that unregisters any already installed.
    workbox: {
      enabled: false,
    },

    // utils/seo.js owns every og:* and twitter:* tag, so @nuxtjs/pwa's own
    // share tags are turned off here. Its manifest and icons are still used.
    meta: {
      // Otherwise @nuxtjs/pwa names the app from package.json.
      name: SITE_NAME,
      description: SITE_DESCRIPTION,

      ogTitle: false,
      ogDescription: false,
      ogImage: false,
      ogUrl: false,
      twitterCard: false,
      twitterSite: false,
      twitterCreator: false,
    },

    manifest: {
      name: SITE_NAME,
      short_name: SITE_NAME,
      description: SITE_DESCRIPTION,
    },
  },

  modules: [
    '@nuxt/content',
    'druxt',
    'druxt-router/nuxt',
    'druxt-schema',
    'druxt-entity',
    'druxt-layout-paragraphs',
    'druxt-menu',
    'druxt-blocks',
    'druxt-views',
    'druxt-breadcrumb',
    // Every core module, so the playground can render every component. Its
    // layout is only added to a site without one.
    'druxt-site',
    // Editor sign-in. The strategy it registers is replaced by `auth` below.
    ['druxt-auth', OAUTH_CLIENT],
    // The consumer's decoupled settings and theme manifest, baked in at build.
    // A copy of the unreleased @druxt-contrib/decoupled-settings module.
    '~/modules/decoupled-settings',
  ],

  decoupledSettings: {
    consumerId: CONSUMER_ID,
    // Each page sets its own title and description.
    applyHead: false,
  },

  druxt: {
    baseUrl: DRUXT_BASE_URL,
    // JSON:API, path lookups and files are served on this origin.
    proxy: { api: true, files: true },
    // The section pages resolve paths themselves; no catch-all route.
    router: { wildcard: false },
    // Menus ask for the fields a menu needs, not every attribute of a link.
    menu: { jsonApiMenuItems: true, query: { requiredOnly: true } },
    // No deprecated default field components: fields render through
    // DruxtField's item slots and this site's own wrappers. Each entity is
    // asked for the fields its display renders, from the generated schema.
    entity: { components: { fields: false }, query: { schema: true } },
    // Display schemas, view and form, for what this site renders. Generated
    // from Drupal's display configuration when the app builds.
    schema: {
      filter: ['node--doc_page--.*', 'paragraph--docs_.*', 'media--image--.*'],
    },
  },

  // @nuxtjs/auth-next: a signed-in editor is sent back to the page they
  // started from, or home; the callback page is the site's own.
  auth: {
    redirect: { login: '/', logout: '/', home: '/', callback: '/callback' },
    cookie: { prefix: AUTH_COOKIE_PREFIX },
    strategies: { [AUTH_STRATEGY]: OAUTH_STRATEGY },
  },

  // changeOrigin: false keeps the browser's host, so Drupal's JSON:API links
  // point at this origin. Registered before Druxt's own proxy entries. The
  // two OAuth endpoints the browser calls are here too: the proxy module
  // reads this list before druxt-auth adds its own entry.
  proxy: [
    ...['/jsonapi', '/router/translate-path', '/sites/default/files', '/oauth/token', '/oauth/userinfo'].map((context) => [
      context,
      { target: DRUXT_BASE_URL, changeOrigin: false },
    ]),
    // The Umami demo backend, for the live component examples. Proxied so the
    // browser stays on this origin and Umami's CORS allowlist never applies.
    [
      '/umami',
      {
        target: 'https://api.umami.demo.druxtjs.org',
        pathRewrite: { '^/umami': '' },
        changeOrigin: true,
        // Another origin's backend gets no first-party credentials: this
        // site's cookies and Authorization headers stay on this origin.
        onProxyReq: (proxyReq) => {
          proxyReq.removeHeader('cookie')
          proxyReq.removeHeader('authorization')
        },
      },
    ],
  ],

  content: {
    markdown: {
      // Anchors are what components/app/Toc.vue scroll-spies against.
      // Token colours come from assets/css/code.css, not a Prism theme.
      prism: { theme: false },
    },
  },

  generate: {
    /**
     * Every content route, given to the generator explicitly.
     *
     * Nuxt's crawler cannot reach the API pages, which AppApiIndex lists client side.
     *
     * @returns {string[]} Route paths to generate.
     */
    routes() {
      const path = require('path')
      const { readContent } = require('./lib/content-index')
      return readContent(path.join(__dirname, 'content')).map((doc) => doc.route)
    },
  },

  hooks: {
    // Druxt's own components load with the page: see lib/sync-druxt-components.js.
    'components:extend': (components) => syncDruxtComponents(components),

    /**
     * Collects routes whose generation failed, so the build can refuse to ship them.
     *
     * @param {object} failure - The failed route.
     * @param {string} failure.route - The route path.
     */
    'generate:routeFailed'({ route }) {
      failedRoutes.push(route)
    },

    /**
     * Write the machine-readable indexes into the static export.
     *
     * Runs on `generate:done`, against the same content the pages were generated from.
     *
     * @param {object} generator - The Nuxt generator instance.
     * @param {object[]} errors - Handled route failures the generator collected.
     */
    async 'generate:done'(generator, errors) {
      // Checked first, so a rejected build leaves no sitemap describing pages
      // it refused to ship. `errors` holds routes that rendered the error page.
      const handled = (errors || []).map((e) => e.route)
      const failed = [...new Set([...failedRoutes, ...handled])]
      if (failed.length) {
        throw new Error(
          'Refusing to ship ' + failed.length + ' route(s) that failed to generate: ' + failed.join(', '),
        )
      }

      const fs = require('fs')
      const path = require('path')
      const { execFileSync } = require('child_process')
      const { readContent } = require('./lib/content-index')
      const { buildLlmsTxt } = require('./lib/llms-txt')
      const { buildSitemap } = require('./lib/sitemap')
      const { buildLlmsFullTxt } = require('./lib/llms-full-txt')

      const { srcDir, generate } = generator.nuxt.options
      const docs = readContent(path.join(srcDir, 'content'))

      await fs.promises.writeFile(path.join(generate.dir, 'llms.txt'), buildLlmsTxt(docs))
      await fs.promises.writeFile(path.join(generate.dir, 'llms-full.txt'), buildLlmsFullTxt(docs))
      await fs.promises.writeFile(path.join(generate.dir, 'sitemap.xml'), buildSitemap(docs))

      // A child process, not a require: satori and resvg crash under the esm
      // config loader's patched module system.
      const cards = execFileSync(process.execPath, [
        path.join(srcDir, 'scripts', 'og-render.js'),
        path.join(srcDir, 'content'),
        path.join(srcDir, 'assets', 'fonts'),
        path.join(generate.dir, 'og'),
      ], { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim()

      console.log('SEO: wrote llms.txt, llms-full.txt, sitemap.xml and ' + cards + ' share cards for ' + docs.length + ' documents')
    },
  },

  // One hashed stylesheet the browser caches across visits, instead of CSS
  // inlined into every page's HTML on every request. The theme-init script
  // still sets the color scheme before this loads, so dark mode doesn't flash.
  build: {
    extractCSS: true,
  },
  telemetry: true,

  storybook: {
    stories: [
      '~/components/**/*.stories.js',
      '~/layouts/**/*.stories.js',
      '~/pages/**/*.stories.js',
    ],
  },
}
