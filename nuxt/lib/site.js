/**
 * Site-wide constants and pure URL helpers.
 *
 * CommonJS so nuxt.config.js can require it at build time; webpack interop
 * lets pages and components import from it too.
 */

/**
 * Canonical origin. Every absolute URL the build emits is built from this.
 *
 * Overridable per build so a preview emits URLs that resolve to itself;
 * scripts/start.sh rewrites the baked origin when the container starts.
 */
const SITE_ORIGIN = process.env.SITE_ORIGIN || 'https://druxtjs.org'

const SITE_NAME = 'DruxtJS'

/** Matches nuxt.config.js `head.titleTemplate`. */
const TITLE_SUFFIX = ' - DruxtJS'

/** Twitter account credited on share cards. */
const TWITTER_HANDLE = '@DruxtJS'

const SITE_DESCRIPTION
  = 'Druxt is a framework for building fully decoupled Drupal and Nuxt.js applications and sites.'

/**
 * The documentation sections.
 *
 * `description` is reused by llms.txt and the section pages' og:description;
 * `priority` and `changefreq` feed sitemap.xml.
 */
/** What the playground page says about itself; its share card and sitemap entry come from PAGES. */
const PLAYGROUND_DESCRIPTION = 'Render every Druxt component live against a Drupal backend, change its props, read the requests it makes, and copy the markup.'

/** The MCP server page's section, for its sitemap entry and llms.txt heading. The page is in Drupal. */
const MCP_DESCRIPTION = 'A read-only server your coding agent can search and read, so it answers from these docs instead of from memory.'

const SECTIONS = {
  mcp: {
    label: 'MCP server',
    description: MCP_DESCRIPTION,
    priority: 0.7,
    changefreq: 'monthly',
  },
  playground: {
    label: 'Playground',
    description: PLAYGROUND_DESCRIPTION,
    priority: 0.8,
    changefreq: 'monthly',
  },
  tutorials: {
    label: 'Tutorials',
    description: 'Lessons that take you from nothing to a working Druxt site, one step at a time.',
    priority: 0.9,
    changefreq: 'monthly',
  },
  'how-to': {
    label: 'How-to guides',
    description: 'Goal-oriented recipes for theming, proxying, multilingual content and the clients.',
    priority: 0.8,
    changefreq: 'monthly',
  },
  explanation: {
    label: 'Concepts',
    description: 'How Druxt works and why: architecture, routing, the store, schemas and component resolution.',
    priority: 0.7,
    changefreq: 'monthly',
  },
  // sectionFor() also returns this for the component reference pages under api.
  components: {
    label: 'Components',
    description: 'Reference for the Druxt Vue components: what each one renders, and the props and slots it takes.',
    priority: 0.5,
    changefreq: 'yearly',
  },
  // Kept for the legacy /guide/* URLs, which redirect to the sections above.
  guide: {
    label: 'Guide',
    description: 'Installation, configuration, theming and contribution docs, written by hand.',
    priority: 0.8,
    changefreq: 'monthly',
  },
  modules: {
    label: 'Modules',
    description: 'Per-module documentation for the Druxt packages: what each one renders and how to override it.',
    priority: 0.8,
    changefreq: 'monthly',
  },
  api: {
    label: 'API',
    description: 'Component, mixin and store reference generated from the package source by druxt-docgen.',
    priority: 0.4,
    changefreq: 'yearly',
  },
}

/**
 * Trim a path to its canonical form: leading slash, no trailing slash, and
 * `/` preserved for the homepage.
 *
 * Both spellings resolve, so one canonical form keeps them a single indexed URL.
 *
 * @param {string} path - A route path, with or without a trailing slash.
 * @returns {string} The canonical path.
 */
const normalisePath = (path) => {
  const trimmed = String(path || '/').replace(/\/+$/, '')
  return trimmed.startsWith('/') ? (trimmed || '/') : '/' + trimmed
}

/**
 * Absolute canonical URL for a route path.
 *
 * @param {string} path - A route path.
 * @returns {string} The absolute URL.
 */
const canonicalUrl = (path) => {
  const normalised = normalisePath(path)
  return SITE_ORIGIN + (normalised === '/' ? '/' : normalised)
}

/**
 * The top-level section a path belongs to, or null for the homepage and any
 * route outside the three documentation sections.
 *
 * @param {string} path - A route path.
 * @returns {string|null} The section key.
 */
const sectionFor = (path) => {
  const normalised = normalisePath(path)
  // Component reference pages live under /api, but belong to the Components section.
  if (/^\/api\/packages\/[^/]+\/components(\/|$)/.test(normalised)) return 'components'
  const first = normalised.split('/').filter(Boolean)[0]
  return first && SECTIONS[first] ? first : null
}

/**
 * Title of last resort, from a path's own last segment.
 *
 * Used by the build and by the runtime `head()` alike, for documents with no
 * frontmatter title.
 *
 * @param {string} path - A route path.
 * @returns {string} A human-readable title, or an empty string for the root.
 */
const titleFromPath = (path) => {
  const segment = normalisePath(path).split('/').filter(Boolean).pop()
  if (!segment) return ''
  const words = segment.replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * The card design's version. Bump it when og-card.js draws differently, so
 * every card's URL changes with it.
 */
const CARD_DESIGN = 1

/**
 * A short FNV-1a hash, the same on the server and in the browser.
 *
 * @param {string} text - Any text.
 * @returns {string} The hash in base 36.
 */
const fingerprint = (text) => {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

/**
 * The generated share card URL for a route, or null where none is generated.
 *
 * Cards exist for every content document; anything else falls back to
 * og/site.png. Share previews are cached by image URL, so a card drawn anew
 * behind the same URL is never fetched again: given the facts the card
 * draws, such as a changelog's newest version, the URL carries a fingerprint
 * of them and changes when they do.
 *
 * @param {string} path - A route path.
 * @param {Array<string>} [facts] - What the card draws.
 * @returns {string|null} Absolute image URL, or null.
 */
const ogImageUrl = (path, facts) => {
  const normalised = normalisePath(path)
  const section = sectionFor(normalised)
  if (!section) return null
  const url = SITE_ORIGIN + '/og' + normalised + '.png'
  return facts ? url + '?v=' + fingerprint([CARD_DESIGN, ...facts].join('\n')) : url
}

/**
 * The Diataxis bucket a path belongs to, as reported to GA4.
 *
 * Reported as a dimension so the sections can be compared in one breakdown.
 * `home` and the legacy `guide` section get buckets of their own.
 *
 * @param {string} path - A route path.
 * @returns {string} `home`, a section key, or `other`.
 */
const docTypeFor = (path) => {
  const first = normalisePath(path).split('/').filter(Boolean)[0]
  if (!first) return 'home'
  // hasOwnProperty, not a truthiness lookup: `/constructor` and `/toString`
  // would otherwise resolve up the prototype chain into buckets of their own.
  return Object.prototype.hasOwnProperty.call(SECTIONS, first) ? first : 'other'
}

/**
 * `docTypeFor` as a self-contained browser expression, for inlining into the
 * GA4 snippet.
 *
 * The section list is baked in from `SECTIONS`, and the unit tests assert the
 * two agree. It stays an expression so it reads `location.pathname` each time
 * the inline snippet re-runs on a client-side navigation.
 *
 * @returns {string} A JavaScript expression yielding the doc type.
 */
const docTypeExpression = () => {
  // Escaped for embedding in an inline <script>: `<` and the JS line
  // separators would otherwise terminate or break the script element.
  const known = JSON.stringify(Object.keys(SECTIONS))
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
  return `(function(){var s=(location.pathname.split('/').filter(Boolean)[0]||'');`
    + `return s?(${known}.indexOf(s)>-1?s:'other'):'home'})()`
}

/**
 * Pages that are not documents but belong in the sitemap, the share cards and
 * llms.txt all the same, in the shape readContent() gives a document.
 */
const PAGES = [
  {
    route: '/playground',
    title: 'Live component playground',
    description: PLAYGROUND_DESCRIPTION,
    weight: 0,
    section: 'playground',
    // What site search matches besides the title: the components it renders.
    keywords: ['DruxtBlock', 'DruxtBlockRegion', 'DruxtBreadcrumb', 'DruxtEntity', 'DruxtEntityForm', 'DruxtMenu', 'DruxtRouter', 'DruxtSite', 'DruxtView'],
  },
]


/**
 * A package's npm name from its directory under packages/, which docgen keys
 * the reference by: `druxt` is itself, the rest take the `druxt-` prefix.
 *
 * @param {string} dir - The directory name, e.g. 'menu'.
 * @returns {string} The npm name, e.g. 'druxt-menu'.
 */
const packageName = (dir) => (dir === 'druxt' ? 'druxt' : `druxt-${dir}`)

module.exports = {
  PAGES,
  PLAYGROUND_DESCRIPTION,
  SITE_ORIGIN,
  SITE_NAME,
  TITLE_SUFFIX,
  SITE_DESCRIPTION,
  TWITTER_HANDLE,
  SECTIONS,
  normalisePath,
  canonicalUrl,
  ogImageUrl,
  sectionFor,
  titleFromPath,
  docTypeFor,
  docTypeExpression, packageName }
