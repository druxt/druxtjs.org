/**
 * Per-page SEO head fragments.
 *
 * The only place the site's Open Graph, Twitter and canonical tags are decided.
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
 * A complete `head()` fragment for a documentation page.
 *
 * Returns `title`, `meta` and `link`, ready to spread into a page's own
 * `head()`. Every tag is keyed by `hid`, so a page can override one by name.
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

  return {
    title: heading || undefined,
    meta: [
      { hid: 'description', name: 'description', content: summary },

      { hid: 'og:type', property: 'og:type', content: type || 'article' },
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
    link: [
      // Collapses the trailing-slash and UTM-tagged variants onto one indexed URL.
      { hid: 'canonical', rel: 'canonical', href: url },
    ],
  }
}
