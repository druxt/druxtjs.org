/**
 * Where an old URL goes: the site's paths before the restructure into
 * tutorials, how-to guides and concepts, the reference pages under their
 * `.html` names, and the package subdomains. Ported from the redirect map
 * the druxt.js build served, so nothing linked from outside is lost.
 */

const HOME = 'https://druxtjs.org'

/** The package documentation sites, now sections of this one. */
const SUBDOMAINS = ['blocks', 'breadcrumb', 'entity', 'menu', 'router', 'schema', 'site', 'views'].map((name) => `${name}.druxtjs.org`)

/** An old path, without its trailing slash, and the page it became. */
const PATHS = {
  '/guide': '/tutorials',
  '/guide/getting-started': '/tutorials/getting-started',
  '/guide/getting-started.html': '/tutorials/getting-started',
  '/guide/client': '/how-to/use-the-druxt-client',
  '/guide/multilingual': '/how-to/multilingual',
  '/guide/proxy': '/how-to/proxy',
  '/guide/storybook': '/how-to/storybook',
  '/guide/devtools': '/how-to/devtools',
  '/guide/theming': '/how-to/theming',
  '/guide/deprecations': '/modules/druxt/deprecations',
  '/guide/deprecations.html': '/modules/druxt/deprecations',
  '/guide/CONTRIBUTING': '/how-to/contributing',
  '/guides/custom-module': '/tutorials/first-custom-module',
  '/guides/node-client': '/how-to/use-the-druxt-client',
  '/modules/site/getting-started': '/tutorials/getting-started',
  '/api/components': '/components',
  '/api/menu.html': '/api/packages/menu',
  '/api/router.html': '/api/packages/router',
  '/api/components/DruxtBlock.html': '/api/packages/blocks/components/DruxtBlock',
  '/api/components/DruxtBlockRegion.html': '/api/packages/blocks/components/DruxtBlockRegion',
  '/api/components/DruxtBreadcrumb.html': '/api/packages/breadcrumb/components/DruxtBreadcrumb',
  '/api/components/DruxtEntity.html': '/api/packages/entity/components/DruxtEntity',
  '/api/components/DruxtEntityForm.html': '/api/packages/entity/components/DruxtEntityForm',
  '/api/components/DruxtField.html': '/api/packages/entity/components/DruxtField',
  '/api/components/DruxtMenu.html': '/api/packages/menu/components/DruxtMenu',
  '/api/components/DruxtMenuItem.html': '/api/packages/menu/components/DruxtMenuItem',
  '/api/components/DruxtRouter.html': '/api/packages/router/components/DruxtRouter',
  '/api/components/DruxtSite.html': '/api/packages/site/components/DruxtSite',
  '/api/components/DruxtView.html': '/api/packages/views/components/DruxtView',
  '/api/components/DruxtViewsFilter.html': '/api/packages/views/components/DruxtViewsFilter',
  '/api/components/DruxtViewsFilters.html': '/api/packages/views/components/DruxtViewsFilters',
  '/api/components/DruxtViewsPager.html': '/api/packages/views/components/DruxtViewsPager',
  '/api/components/DruxtViewsSorts.html': '/api/packages/views/components/DruxtViewsSorts',
  '/api/mixins/block.html': '/api/packages/blocks/mixins/block',
  '/api/mixins/breadcrumb.html': '/api/packages/breadcrumb/mixins/breadcrumb',
  '/api/mixins/field.html': '/api/packages/entity/mixins/field',
  '/api/mixins/menu.html': '/api/packages/menu/mixins/menu',
  '/api/mixins/router.html': '/api/packages/router/mixins/router',
  '/api/mixins/schema.html': '/api/packages/schema/mixins/schema',
  '/api/mixins/site.html': '/api/packages/site/mixins/site',
  '/api/mixins/filter.html': '/api/packages/views/mixins/filter',
  '/api/mixins/filters.html': '/api/packages/views/mixins/filters',
  '/api/mixins/pager.html': '/api/packages/views/mixins/pager',
  '/api/mixins/sorts.html': '/api/packages/views/mixins/sorts',
  '/api/mixins/view.html': '/api/packages/views/mixins/view',
  '/api/stores/menu.html': '/api/packages/menu/stores/menu',
  '/api/stores/router.html': '/api/packages/router/stores/router',
  '/api/stores/schema.html': '/api/packages/schema/stores/schema',
  '/api/stores/views.html': '/api/packages/views/stores/views',
}

/** Paths that named a different page on each package site. */
const HOST_PATHS = {
  'entity.druxtjs.org': { '/api/mixins/entity.html': '/api/packages/entity/mixins/entity' },
  'router.druxtjs.org': { '/api/mixins/entity.html': '/api/packages/router/mixins/entity' },
  'menu.druxtjs.org': { '/api/nuxtModule.html': '/api/packages/menu/nuxtModule' },
  'schema.druxtjs.org': { '/api/nuxtModule.html': '/api/packages/schema/nuxtModule' },
  'site.druxtjs.org': { '/api/nuxtModule.html': '/api/packages/site/nuxtModule' },
  'views.druxtjs.org': { '/api/nuxtModule.html': '/api/packages/views/nuxt' },
}

/**
 * The URL a request should be sent to instead, or null when it is served here.
 *
 * @param {string} host - The request's Host header.
 * @param {string} pathname - The request path.
 * @param {string} [search] - The query string, kept on the redirect.
 * @returns {string|null} An absolute URL from a package subdomain, a path on this host, or null.
 */
const redirectFor = (host, pathname, search = '') => {
  const site = String(host || '').split(':')[0].replace(/^www\./, '')
  const path = pathname.replace(/\/+$/, '') || '/'
  const to = (HOST_PATHS[site] || {})[path] || PATHS[path]
  if (to) return (SUBDOMAINS.includes(site) ? HOME : '') + to + search
  if (SUBDOMAINS.includes(site)) return HOME + pathname + search
  return null
}

module.exports = { PATHS, HOST_PATHS, SUBDOMAINS, redirectFor }
