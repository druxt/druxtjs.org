/**
 * Per-page SEO head fragments.
 *
 * The only place the site's Open Graph, Twitter, canonical and structured
 * data tags are decided.
 */

import { SITE_ORIGIN, SITE_NAME, SITE_DESCRIPTION, TITLE_SUFFIX, TWITTER_HANDLE, SECTIONS, canonicalUrl, ogImageUrl, sectionFor, titleFromPath } from '~/lib/site'

/** Longest description worth emitting. Google truncates around 160 characters. */
const DESCRIPTION_LIMIT = 160

/**
 * Trim a description to a whole word within the limit.
 *
 * @param {string} text - Source text.
 * @returns {string} The trimmed description.
 */
export const clampDescription = (text) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim()
  if (value.length <= DESCRIPTION_LIMIT) return value

  const cut = value.slice(0, DESCRIPTION_LIMIT)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.]$/, '') + '…'
}

/**
 * The description for a page, falling back to the section's and then the
 * site's rather than to an empty string.
 *
 * The generated API pages have no prose to excerpt, which is what the section
 * fallback is for.
 *
 * @param {object} context - The page context.
 * @param {string} [context.description] - The document's own description.
 * @param {string} context.path - The route path.
 * @returns {string} A description.
 */
export const descriptionFor = ({ description, path }) => {
  if (description) return clampDescription(description)
  const section = sectionFor(path)
  return clampDescription(section ? SECTIONS[section].description : SITE_DESCRIPTION)
}

/**
 * The site's publisher identity, named on every page.
 *
 * @returns {object} An Organization graph.
 */
const organizationGraph = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_ORIGIN + '/',
  logo: SITE_ORIGIN + '/icon.png',
})

/**
 * The site itself, named on every page.
 *
 * @returns {object} A WebSite graph.
 */
const websiteGraph = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_ORIGIN + '/',
})

/**
 * A documentation page, as a document rather than a marketing page.
 *
 * @param {object} page - What the page knows about itself.
 * @param {string} page.heading - The page title, without the site suffix.
 * @param {string} page.summary - The clamped description.
 * @param {string} page.url - The canonical URL.
 * @returns {object} A TechArticle graph.
 */
const techArticleGraph = ({ heading, summary, url }) => ({
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: heading,
  description: summary,
  url,
  author: { '@type': 'Organization', name: SITE_NAME },
  publisher: { '@type': 'Organization', name: SITE_NAME },
})

/**
 * The breadcrumb a page sits under: its section, then the page itself. A
 * section index page is its own single crumb; the homepage and any route
 * outside the sections have none, rather than an invented one.
 *
 * @param {object} page - What the page knows about itself.
 * @param {string} page.path - The route path.
 * @param {string} page.heading - The page title, without the site suffix.
 * @param {string} page.url - The canonical URL.
 * @returns {object|null} A BreadcrumbList graph, or null.
 */
const breadcrumbGraph = ({ path, heading, url }) => {
  const section = sectionFor(path)
  if (!section) return null
  const crumb = (position, name, item) => ({ '@type': 'ListItem', position, name, item })
  const list = [crumb(1, SECTIONS[section].label, SITE_ORIGIN + '/' + section)]
  if (path !== '/' + section) list.push(crumb(2, heading, url))
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: list }
}

/**
 * A complete `head()` fragment for a documentation page.
 *
 * Returns `title`, `meta`, `script` and `link`, ready to spread into a page's
 * own `head()`. Every tag is keyed by `hid`, so a page can override one by name.
 *
 * @param {object} context - The page context.
 * @param {string} context.title - The document title, without the site suffix.
 * @param {string} [context.description] - The document's own description.
 * @param {string} context.path - The route path.
 * @param {string} [context.image] - Absolute share image URL.
 * @param {string} [context.type] - Open Graph type; 'article' for documents.
 * @returns {object} A vue-meta head fragment.
 */
export const seoHead = ({ title, description, path, image, type }) => {
  const url = canonicalUrl(path)
  // A document with no frontmatter title falls back to its path. The homepage
  // passes none deliberately.
  const heading = title || (path === '/' ? '' : titleFromPath(path))
  const summary = descriptionFor({ description, path })
  // og:title carries the suffix because a share card has no browser chrome;
  // <title> gets it from head.titleTemplate instead.
  const shareTitle = heading ? heading + TITLE_SUFFIX : SITE_NAME
  // Section pages get their generated card; everything else the site card.
  const shareImage = image || ogImageUrl(path) || SITE_ORIGIN + '/og/site.png'
  const ogType = type || 'article'
  const breadcrumb = breadcrumbGraph({ path, heading, url })

  return {
    title: heading || undefined,
    meta: [
      { hid: 'description', name: 'description', content: summary },

      { hid: 'og:type', property: 'og:type', content: ogType },
      { hid: 'og:title', property: 'og:title', content: shareTitle },
      { hid: 'og:description', property: 'og:description', content: summary },
      { hid: 'og:url', property: 'og:url', content: url },
      { hid: 'og:image', property: 'og:image', content: shareImage },
      { hid: 'og:site_name', property: 'og:site_name', content: SITE_NAME },

      // Dimensions for the site's own 1200x630 cards. A caller-supplied image
      // is of unknown size, so it gets no claim rather than a wrong one.
      ...(image ? [] : [
        { hid: 'og:image:width', property: 'og:image:width', content: '1200' },
        { hid: 'og:image:height', property: 'og:image:height', content: '630' },
      ]),

      { hid: 'twitter:card', name: 'twitter:card', content: 'summary_large_image' },
      { hid: 'twitter:site', name: 'twitter:site', content: TWITTER_HANDLE },
      { hid: 'twitter:title', name: 'twitter:title', content: shareTitle },
      { hid: 'twitter:description', name: 'twitter:description', content: summary },
      { hid: 'twitter:image', name: 'twitter:image', content: shareImage },
    ],
    // Structured data, serialized from the json key by vue-meta. Every page
    // names the organization and the site; a document adds itself as a
    // TechArticle, under its breadcrumb when it has one.
    script: [
      { hid: 'ld-organization', type: 'application/ld+json', json: organizationGraph() },
      { hid: 'ld-website', type: 'application/ld+json', json: websiteGraph() },
      ...(ogType === 'article'
        ? [{ hid: 'ld-article', type: 'application/ld+json', json: techArticleGraph({ heading, summary, url }) }]
        : []),
      ...(breadcrumb
        ? [{ hid: 'ld-breadcrumbs', type: 'application/ld+json', json: breadcrumb }]
        : []),
    ],
    link: [
      // Collapses the trailing-slash and UTM-tagged variants onto one indexed URL.
      { hid: 'canonical', rel: 'canonical', href: url },
    ],
  }
}
