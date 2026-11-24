/**
 * What the live example card knows about each Druxt component.
 *
 * A stopgap until docgen emits this per component: the props a reader can
 * change, where a select's options come from, and what each select prefers
 * on its own. The card reads nothing else.
 */

import { isMockUrl, mockFetch, mockOrigin, mockRoot } from './mock-backend.js'

/** The backend select's groups, in order: each backend names one. */
export const BACKEND_GROUPS = {
  live: 'Live Drupal',
  mock: 'Mocked in your browser',
}

/**
 * A mock: its requests are answered in the browser by decoupled-drupal-mock,
 * and its files are served from this site.
 *
 * @param {string} preset - The preset, as mock-backend.js names it.
 * @param {object} backend - The rest of the backend: its labels, content and preferences.
 * @returns {object} A backend like the others in BACKENDS.
 */
const mockBackend = (preset, backend) => ({
  group: 'mock',
  api: `${mockOrigin(preset)}/jsonapi`,
  baseUrl: mockOrigin(preset),
  proxyRoot: mockOrigin(preset),
  filesRoot: mockRoot(preset),
  mock: preset,
  ...backend,
})

// What a Drupal CMS site template demos best, where the site's own choice is
// not on it. Keyed by component, then by the select's name.
const drupalCms = (prefer) => ({
  drupalCms: true,
  canvasPages: true,
  prefer: {
    DruxtEntity: { entityType: 'node', ...prefer.entity },
    DruxtEntityForm: { ...prefer.entity },
    DruxtMenu: { name: 'main' },
    DruxtView: { viewId: prefer.view },
    DruxtBreadcrumb: { path: prefer.path },
    ...(prefer.router === false ? {} : { DruxtRouter: { path: prefer.path } }),
  },
})

/**
 * Backends the card can render against. The first two are proxied onto this
 * origin: `api` is where the option lists come from; a runtime's client is
 * told the backend's own `baseUrl` (this site's when unset) and sends through
 * `proxyRoot`. The mocks never leave the browser. `label` names a backend on
 * its own; `short` names it inside its group in the select.
 */
export const BACKENDS = {
  // Its Storybook is the environment's own, read from the runtime config.
  site: { group: 'live', label: 'Druxtjs.org', api: '/jsonapi', baseUrl: null, proxyRoot: '', nodeBundles: ['doc_page'], storybookLabel: 'Druxtjs.org' },
  umami: {
    group: 'live',
    label: 'Umami demo',
    api: '/umami/jsonapi',
    baseUrl: 'https://api.umami.demo.druxtjs.org',
    proxyRoot: '/umami',
    nodeBundles: ['recipe', 'article', 'page'],
    storybook: 'https://storybook.umami.demo.druxtjs.org/',
    storybookLabel: 'Umami',
    umami: true,
  },
  mock: mockBackend('umami', {
    label: 'Umami mock, in your browser',
    short: 'Umami',
    umami: true,
    nodeBundles: ['recipe', 'article', 'page'],
  }),
  dashi: mockBackend('dashi', {
    label: 'Dashi mock (Drupal CMS), in your browser',
    short: 'Dashi (Drupal CMS)',
    nodeBundles: ['recipe', 'article'],
    ...drupalCms({ entity: { bundle: 'recipe', uuid: /Deep mediterranean quiche/ }, view: 'recipes', path: /\/recipes\/deep-mediterranean-quiche/ }),
  }),
  haven: mockBackend('haven', {
    label: 'Haven mock (Drupal CMS), in your browser',
    short: 'Haven (Drupal CMS)',
    nodeBundles: ['blog', 'project', 'person_profile', 'page'],
    ...drupalCms({ entity: { bundle: 'project', uuid: /Restoring the outer reef/ }, view: 'projects', path: /\/projects\/.*restoring-outer-reef/ }),
  }),
  mercury: mockBackend('mercury', {
    label: 'Mercury mock (Drupal CMS), in your browser',
    short: 'Mercury (Drupal CMS)',
    // Its one node is unpublished: its content is Canvas pages.
    nodeBundles: [],
    ...drupalCms({ entity: { entityType: 'media', bundle: 'image' }, path: /\/card-components/, router: false }),
  }),
}

/**
 * The backends a select offers, a group at a time.
 *
 * @param {object} backends - BACKENDS, with a reader's own when there is one.
 * @returns {{ key: string, label: string, backends: string[] }[]} Each group and its backends' keys.
 */
export const groupBackends = (backends) =>
  Object.entries(BACKEND_GROUPS)
    .map(([key, label]) => ({ key, label, backends: Object.keys(backends).filter((k) => (backends[k].group || 'live') === key) }))
    .filter((g) => g.backends.length)

const get = async (api, path) => {
  const send = isMockUrl(api) ? mockFetch : fetch
  const response = await send(`${api}${path}`, { headers: { Accept: 'application/vnd.api+json' } })
  if (!response.ok) throw new Error(`${response.status} from ${path}`)
  return response.json()
}

/**
 * Every page of a collection: JSON:API answers 50 at a time, and a Drupal
 * CMS site has more view displays than that.
 *
 * @param {string} api - The backend's JSON:API root.
 * @param {string} path - The collection, with its query.
 * @param {number} [most] - The pages to read at most.
 * @returns {Promise<{ data: object[] }>} The collection, every page in one.
 */
const getAll = async (api, path, most = 10) => {
  const first = await get(api, path)
  const data = [...first.data]
  let next = (first.links || {}).next
  for (let i = 1; next && i < most; i++) {
    // The link is the backend's own URL: keep what follows its JSON:API root,
    // and ask through this card's root for it, proxied or mocked.
    const href = next.href || next
    const page = await get(api, href.slice(href.indexOf('/jsonapi/') + '/jsonapi'.length))
    data.push(...page.data)
    next = (page.links || {}).next
  }
  return { data }
}

/**
 * A reader's own Drupal as a backend. The browser talks to it directly, so
 * it must allow this origin (CORS); nothing here is proxied.
 *
 * @param {string} origin - The Drupal's origin, `https://example.com`.
 * @returns {object} A backend like those in BACKENDS.
 */
export const customBackend = (origin) => ({
  label: new URL(origin).host,
  api: `${origin}/jsonapi`,
  baseUrl: origin,
  proxyRoot: origin,
  custom: true,
})

/**
 * The origin a reader typed, as one this card can use, or the reason it cannot.
 *
 * @param {string} input - What was typed.
 * @param {string} [pageProtocol] - This page's protocol: an https page cannot fetch http.
 * @returns {{ origin?: string, error?: string }} The origin, or the problem.
 */
export const parseOrigin = (input, pageProtocol = 'https:') => {
  let url
  try {
    url = new URL(/^https?:\/\//.test(input.trim()) ? input.trim() : `https://${input.trim()}`)
  } catch (e) {
    return { error: 'That is not a URL.' }
  }
  if (pageProtocol === 'https:' && url.protocol !== 'https:') return { error: 'It must be https: this page is, and a browser will not mix the two.' }
  return { origin: url.origin }
}

/**
 * What a Drupal offers, by asking it. Each check names the component it
 * unlocks; a failed one becomes that component's reason in the backend list.
 *
 * @param {string} origin - The Drupal's origin.
 * @returns {Promise<{ backend: object, links: object }>} The backend, its per-component reasons filled in.
 */
export const probeBackend = async (origin) => {
  const backend = customBackend(origin)
  let index
  try {
    index = await get(backend.api, '')
  } catch (e) {
    throw new Error(e instanceof TypeError
      ? `The browser could not reach ${backend.api}. If it is up, that Drupal has to allow this origin: enable CORS in its services.yml.`
      : `No JSON:API answered at ${backend.api} (${e.message}).`)
  }
  const links = index.links || {}
  const reasons = {}
  // A module is there when its endpoint answers 2xx. A 404 means it is missing; anything else is that Drupal refusing.
  const answers = async (url, what) => {
    const status = await fetch(url, { headers: { Accept: 'application/vnd.api+json' } }).then((r) => r.status, () => 0)
    if (status >= 200 && status < 300) return null
    return status === 404 || status === 0 ? `needs ${what} on that Drupal` : `that Drupal answers ${status} for ${what}`
  }
  // The first of a collection, for a request that needs a real name.
  const first = async (path) => (((await get(backend.api, path).catch(() => ({}))).data || [])[0] || {}).attributes || {}
  // The router: one path resolved, whatever it answers with.
  const router = await answers(`${origin}/router/translate-path?path=/`, 'Decoupled Router')
  if (router) reasons.DruxtRouter = reasons.DruxtBreadcrumb = reasons.DruxtSite = router
  // Menu items and views add nothing to the index; ask for one of each.
  const menu = links['menu--menu'] ? (await first('/menu/menu?page%5Blimit%5D=1&fields%5Bmenu--menu%5D=drupal_internal__id')).drupal_internal__id : null
  const menuReason = menu ? await answers(`${backend.api}/menu_items/${menu}`, 'JSON:API Menu Items') : 'needs JSON:API Menu Items on that Drupal'
  if (menuReason) reasons.DruxtMenu = menuReason
  const view = links['view--view'] ? await first('/view/view?page%5Blimit%5D=1&fields%5Bview--view%5D=drupal_internal__id,display') : {}
  const display = Object.keys(view.display || {})[0]
  const viewReason = display ? await answers(`${backend.api}/views/${view.drupal_internal__id}/${display}`, 'JSON:API Views') : 'needs JSON:API Views on that Drupal'
  if (viewReason) reasons.DruxtView = viewReason
  if (!links['block--block']) reasons.DruxtBlock = reasons.DruxtBlockRegion = 'exposes no blocks over JSON:API'
  // The content types the router examples list: every node type it has.
  const nodeBundles = Object.keys(links).map((k) => k.match(/^node--(.+)$/)).filter(Boolean).map((m) => m[1])
  return { backend: { ...backend, nodeBundles: nodeBundles.length ? nodeBundles : undefined, reasons }, links }
}

const label = (o) => {
  const a = o.attributes || {}
  return a.title || a.name || a.info || a.label || a.drupal_internal__id || o.id
}

/**
 * Option lists a select can be filled from. Each returns [{ value, label, group? }].
 * Dependent sources take the values chosen before them.
 */
export const SOURCES = {
  blocks: async (api) => {
    const { data } = await get(api, '/block/block?page%5Blimit%5D=50')
    return data
      .filter((o) => o.attributes.status)
      .map((o) => ({
        value: o.id,
        label: o.attributes.drupal_internal__id,
        suffix: o.attributes.region,
        group: o.attributes.theme,
      }))
      .sort((a, b) => (a.group + a.label).localeCompare(b.group + b.label))
  },

  themes: async (api) => {
    const { data } = await get(api, '/block/block?page%5Blimit%5D=50&fields%5Bblock--block%5D=theme')
    return [...new Set(data.map((o) => o.attributes.theme))].sort().map((t) => ({ value: t, label: t }))
  },

  regions: async (api, { theme }) => {
    if (!theme) return []
    const { data } = await get(api, '/block/block?page%5Blimit%5D=50&fields%5Bblock--block%5D=region,theme')
    return [...new Set(data.filter((o) => o.attributes.theme === theme).map((o) => o.attributes.region))]
      .sort()
      .map((r) => ({ value: r, label: r }))
  },

  // Entity types, then bundles, from the enabled view displays.
  entityTypes: async (api) => {
    const { data } = await getAll(api, '/entity_view_display/entity_view_display?filter%5Bstatus%5D=1&fields%5Bentity_view_display--entity_view_display%5D=targetEntityType')
    return [...new Set(data.map((o) => o.attributes.targetEntityType))].sort().map((t) => ({ value: t, label: t }))
  },

  bundles: async (api, { entityType }) => {
    if (!entityType) return []
    const { data } = await getAll(api, `/entity_view_display/entity_view_display?filter%5Bstatus%5D=1&filter%5BtargetEntityType%5D=${entityType}&fields%5Bentity_view_display--entity_view_display%5D=bundle`)
    return [...new Set(data.map((o) => o.attributes.bundle))].sort().map((b) => ({ value: b, label: b }))
  },

  entities: async (api, { entityType, bundle }) => {
    if (!entityType || !bundle) return []
    const { data } = await get(api, `/${entityType}/${bundle}?page%5Blimit%5D=50`)
    // The Storybook stories label entities `title (id)`; the card matches them.
    return data.map((o) => ({ value: o.id, label: `${label(o)} (${o.id.slice(0, 8)})` })).sort((a, b) => a.label.localeCompare(b.label))
  },

  // View modes or form modes for a bundle, by schemaType.
  modes: async (api, { entityType, bundle, schemaType = 'view' }) => {
    if (!entityType || !bundle) return []
    const type = `entity_${schemaType}_display`
    const { data } = await get(api, `/${type}/${type}?filter%5Bstatus%5D=1&filter%5BtargetEntityType%5D=${entityType}&filter%5Bbundle%5D=${bundle}&fields%5B${type}--${type}%5D=mode`)
    return [...new Set(data.map((o) => o.attributes.mode))]
      .sort((a, b) => (a === 'default' ? -1 : b === 'default' ? 1 : a.localeCompare(b)))
      .map((m) => ({ value: m, label: m }))
  },

  menus: async (api) => {
    const { data } = await get(api, '/menu/menu?page%5Blimit%5D=50')
    // Labelled `label (machine_name)`, as the Storybook stories label them.
    return data.map((o) => ({ value: o.attributes.drupal_internal__id, label: `${o.attributes.label} (${o.attributes.drupal_internal__id})` })).sort((a, b) => a.label.localeCompare(b.label))
  },

  // Content views only: JSON:API Views exposes every view, and the admin
  // listings are noise here.
  views: async (api) => {
    const { data } = await get(api, '/view/view?page%5Blimit%5D=50&filter%5Bstatus%5D=1')
    const content = (o) => {
      const paths = Object.values(o.attributes.display || {}).map((d) => ((d.display_options || {}).path || ''))
      return o.attributes.base_table === 'node_field_data' && !paths.some((path) => /^admin(\/|$)/.test(path))
    }
    return data.filter(content).map((o) => ({ value: o.attributes.drupal_internal__id, label: `${o.attributes.label} (${o.attributes.drupal_internal__id})` })).sort((a, b) => a.label.localeCompare(b.label))
  },

  // The backend's languages, for the langcode prop. A monolingual site without
  // the language module has no such resource, which its index says, so it is
  // not asked for one it would answer with a 404.
  languages: async (api) => {
    const { links = {} } = await get(api, '')
    if (!links['configurable_language--configurable_language']) return []
    const { data } = await get(api, '/configurable_language/configurable_language?fields%5Bconfigurable_language--configurable_language%5D=drupal_internal__id,label,locked')
    return data.filter((o) => !o.attributes.locked).map((o) => ({ value: o.attributes.drupal_internal__id, label: `${o.attributes.label} (${o.attributes.drupal_internal__id})` }))
  },

  // Paths the router can resolve: this backend's content, by title, a group
  // per content type. A Drupal CMS site's Canvas pages are a group of their own.
  paths: async (api, deps, backend) => {
    const { nodeBundles, canvasPages } = backend || {}
    const types = [
      ...(nodeBundles || ['page']).map((bundle) => ({ path: `node/${bundle}`, group: bundle })),
      ...(canvasPages ? [{ path: 'canvas_page/canvas_page', group: 'Canvas page' }] : []),
    ]
    const lists = await Promise.all(types.map(({ path }) => get(api, `/${path}?page%5Blimit%5D=50&sort=title&fields%5B${path.replace('/', '--')}%5D=title,path`).catch(() => ({ data: [] }))))
    return lists.flatMap(({ data }, i) => data
      .filter((o) => (o.attributes.path || {}).alias)
      .map((o) => ({ value: o.attributes.path.alias, label: `${o.attributes.title} (${o.attributes.path.alias})`, ...(types.length > 1 ? { group: types[i].group } : {}) })))
  },

  // Paths DruxtRouter renders: content only. A Canvas page renders through it
  // with its fields and none of its components, which shows nothing.
  contentPaths: (api, deps, backend) => SOURCES.paths(api, deps, { ...backend, canvasPages: false }),

  displays: async (api, { viewId }) => {
    if (!viewId) return []
    const { data } = await get(api, `/view/view?filter%5Bdrupal_internal__id%5D=${viewId}`)
    const displays = ((data[0] || {}).attributes || {}).display || {}
    return Object.keys(displays).map((d) => ({ value: d, label: d }))
  },
}

/**
 * What a backend prefers for one of a component's selects, over the
 * component's own preference: a Drupal CMS mock's content is not this site's
 * or Umami's.
 *
 * @param {object} backend - One of BACKENDS.
 * @param {string} component - The component's name.
 * @param {string} name - The select's name.
 * @returns {*} The preference, or undefined for none.
 */
export const backendPreference = (backend, component, name) => (((backend || {}).prefer || {})[component] || {})[name]

// A Drupal CMS site template lays its pages out with Canvas, and places
// blocks only in its admin themes, which nothing here renders.
const CANVAS_LAYOUT = 'lays its pages out with Canvas, so it has blocks only for its admin themes'
const BLOCKS = { site: true, umami: true, mock: true, dashi: CANVAS_LAYOUT, haven: CANVAS_LAYOUT, mercury: CANVAS_LAYOUT }

/** Whether the card is on Umami's content: the live demo or the mock of it. */
const isUmami = (card) => !!(BACKENDS[card.backend] || {}).umami

/** The frontend theme: this site's own, or the Umami demo's. */
const siteTheme = (card) => (isUmami(card) ? 'umami' : ((card.$config || {}).decoupledTheme || {}).default)

/** One value per backend: what demos best on each. */
const perBackend = (site, umami) => (card) => (isUmami(card) ? umami : site)

/**
 * The option a select takes on its own: the one whose value is `want`, or
 * whose label matches it when `want` is a pattern, else the first.
 *
 * @param {object[]} list - Options, each { value, label }.
 * @param {string|RegExp} [want] - What the select prefers.
 * @returns {*} The chosen option's value, or undefined from an empty list.
 */
export const pickOption = (list, want) => {
  const match = want instanceof RegExp ? list.find((o) => want.test(o.label || '')) : want && list.find((o) => o.value === want)
  return ((match || list[0]) || {}).value
}

/**
 * One entry per component. `props` are rows in the panel, in order;
 * `chain` groups dependent selects into one row. A select's `prefer` is what
 * it takes on its own: a value, a pattern its label matches, or a function of
 * the card returning either, so each backend gets what demos best. `backends`
 * limits a component to the backends that can serve it, with the reason.
 */
export const COMPONENTS = {
  DruxtBlock: {
    story: 'druxt-blocks-druxtblock--default',
    args: ['id', 'uuid'],
    backends: BLOCKS,
    props: [
      { name: 'uuid', type: 'string', control: 'select', source: 'blocks', required: true, prefer: perBackend(/branding/, /umami_banner_recipes/), description: 'The block entity UUID.' },
    ],
  },

  DruxtBlockRegion: {
    story: 'druxt-blocks-druxtblockregion--default',
    args: [],
    backends: BLOCKS,
    chain: {
      label: 'theme, region',
      description: 'Each one narrows the next.',
      steps: [
        { name: 'theme', source: 'themes', required: true, prefer: siteTheme },
        // The header on both: a banner region's blocks show only on their own pages.
        // The content region: the header would show the very block the block example does.
        { name: 'name', source: 'regions', needs: ['theme'], prefer: 'content' },
      ],
    },
    props: [],
  },

  DruxtEntity: {
    story: 'druxt-entity-druxtentity--default',
    args: ['type', 'schemaType'],
    chain: {
      label: 'type, uuid, mode',
      description: 'Each one narrows the next.',
      steps: [
        { name: 'entityType', source: 'entityTypes', required: true, internal: true, prefer: perBackend('paragraph', 'node') },
        { name: 'bundle', source: 'bundles', needs: ['entityType'], required: true, internal: true, prefer: perBackend('docs_diagram', 'recipe') },
        { name: 'uuid', source: 'entities', needs: ['entityType', 'bundle'], prefer: perBackend(undefined, /Deep mediterranean quiche/) },
        { name: 'mode', source: 'modes', needs: ['entityType', 'bundle', 'schemaType'], prefer: 'full' },
      ],
      // `type` is built from the two internal steps.
      compose: ({ entityType, bundle }) => (entityType && bundle ? { type: `${entityType}--${bundle}` } : {}),
    },
    props: [
      { name: 'schemaType', type: 'enum', control: 'segmented', options: ['view', 'form'], default: 'view', note: 'Form swaps mode for form modes.', description: 'Drupal display schema type.' },
    ],
  },

  DruxtEntityForm: {
    story: 'druxt-entity-druxtentityform--default',
    args: ['type'],
    chain: {
      label: 'type, uuid, mode',
      description: 'Each one narrows the next.',
      steps: [
        { name: 'entityType', source: 'entityTypes', required: true, internal: true, prefer: 'node' },
        { name: 'bundle', source: 'bundles', needs: ['entityType'], required: true, internal: true, prefer: perBackend('doc_page', 'recipe') },
        { name: 'uuid', source: 'entities', needs: ['entityType', 'bundle'], prefer: perBackend(/Getting started/, /Deep mediterranean quiche/) },
        { name: 'mode', source: 'modes', needs: ['entityType', 'bundle', 'schemaType'], prefer: 'full' },
      ],
      compose: ({ entityType, bundle }) => (entityType && bundle ? { type: `${entityType}--${bundle}` } : {}),
    },
    // DruxtEntity with the schema fixed to form, plus submit and reset events.
    fixedValues: { schemaType: 'form' },
    props: [],
  },

  DruxtMenu: {
    story: 'druxt-menu-druxtmenu--default',
    args: ['name'],
    props: [
      { name: 'name', type: 'string', control: 'select', source: 'menus', default: 'main', prefer: (card) => (isUmami(card) ? 'main' : 'docs'), description: 'The menu machine name.' },
      { name: 'minDepth', type: 'number', control: 'number', default: 0, description: 'The minimum depth to render.' },
      { name: 'maxDepth', type: 'number', control: 'number', default: null, description: 'The maximum depth to render.' },
    ],
  },

  DruxtView: {
    story: 'druxt-views-druxtview--default',
    args: [],
    // JSON:API Views is not on this site's Drupal yet. The Umami mock has
    // each view's first page only, as its preset recorded them; every view on
    // Dashi and Haven fits on its first page. Mercury's are not of content.
    backends: {
      umami: true,
      site: 'needs JSON:API Views on that Drupal',
      mock: 'has only the first page of each view, so its pager would fail',
      dashi: true,
      haven: true,
      mercury: 'has no views of content',
    },
    chain: {
      label: 'viewId, displayId',
      description: 'Each one narrows the next.',
      steps: [
        { name: 'viewId', source: 'views', required: true, prefer: (card) => (isUmami(card) ? 'recipes' : 'frontpage') },
        { name: 'displayId', source: 'displays', needs: ['viewId'], default: 'default' },
      ],
    },
    props: [
      { name: 'arguments', type: 'string', control: 'text', description: 'Contextual filter arguments, comma separated.' },
    ],
  },

  DruxtBreadcrumb: {
    story: 'druxt-breadcrumb-druxtbreadcrumb--default',
    args: [],
    props: [
      { name: 'path', type: 'string', control: 'select', source: 'paths', required: true, prefer: perBackend(/getting-started/, /deep-mediterranean-quiche/), description: 'The path to build the breadcrumb for; the current route when unset.' },
      { name: 'home', type: 'boolean', control: 'toggle', default: true, description: 'Whether to include the home link.' },
    ],
  },

  DruxtRouter: {
    story: 'druxt-router-druxtrouter--default',
    args: [],
    backends: {
      site: true,
      umami: true,
      mock: true,
      dashi: true,
      haven: true,
      mercury: 'has Canvas pages only, which DruxtRouter renders without their components',
    },
    props: [
      // A short page: the card shows the router resolving a path, not a long read.
      { name: 'path', type: 'string', control: 'select', source: 'contentPaths', required: true, prefer: perBackend('/explanation/drupal-for-nuxt-developers', '/about-umami'), description: 'The path to resolve; the current route when unset.' },
    ],
  },

  DruxtSite: {
    story: 'druxt-site-druxtsite--default',
    args: [],
    backends: BLOCKS,
    props: [
      { name: 'theme', type: 'string', control: 'select', source: 'themes', required: true, prefer: siteTheme, description: 'The Drupal theme whose regions render.' },
    ],
  },
}

/** The wrapper prop, the last row on every component: through Druxt's wrapper, or the data only. */
export const WRAPPER_PROP = {
  name: 'wrapper',
  type: 'boolean',
  control: 'toggle',
  default: true,
  description: 'Render through the wrapper Druxt resolves, or the data only.',
}

export const COMPONENT_NAMES = Object.keys(COMPONENTS)

/**
 * The other two tiers of the 45 components druxt.js ships.
 *
 * Tier 2 renders only inside a parent: its required props are objects a
 * parent passes, which no select can produce. Tier 3 is the shipped default
 * wrappers, which are output, never a card of their own.
 */
export const CONTEXT_ONLY = {
  DruxtField: { parent: 'DruxtEntity' },
  DruxtMenuItem: { parent: 'DruxtMenu' },
  DruxtViewsFilter: { parent: 'DruxtView' },
  DruxtViewsFilters: { parent: 'DruxtView' },
  DruxtViewsSorts: { parent: 'DruxtView' },
  DruxtViewsPager: { parent: 'DruxtView' },
  DruxtEntityFormButtons: { parent: 'DruxtEntityForm' },
  DruxtRouterEntity: { parent: 'DruxtRouter' },
  DruxtRouterView: { parent: 'DruxtRouter' },
  Druxt: { reason: "Druxt's own machinery" },
  DruxtModule: { reason: 'The base every module component extends' },
  DruxtWrapper: { reason: 'What Druxt renders when nothing else matches' },
  DruxtDebug: { reason: 'Development output' },
  DruxtDevelTemplate: { reason: 'Development output' },
}

export const SHIPPED_WRAPPERS = {
  DruxtBlockBlockContent: { by: 'DruxtBlock', when: 'the plugin is block_content' },
  DruxtBlockPageTitleBlock: { by: 'DruxtBlock', when: 'the plugin is page_title_block' },
  DruxtBlockSystemMainBlock: { by: 'DruxtBlock', when: 'the plugin is system_main_block' },
  DruxtBlockSystemBreadcrumbBlock: { by: 'DruxtBlock', when: 'the plugin is system_breadcrumb_block' },
  DruxtBlockSystemMenuBlock: { by: 'DruxtBlock', when: 'the plugin is system_menu_block' },
  DruxtBlockViewsBlock: { by: 'DruxtBlock', when: 'the plugin is views_block' },
  ...Object.fromEntries(
    [
      'BasicString', 'DatetimeDefault', 'EntityReferenceEntityView', 'EntityReferenceLabel',
      'EntityReferenceRevisionsEntityView', 'FileDefault', 'Image', 'Link', 'ListDefault',
      'NumberInteger', 'ResponsiveImage', 'String', 'TextDefault', 'TextSummaryOrTrimmed',
      'TextTrimmed', 'Timestamp',
    ].map((name) => [`DruxtField${name}`, { by: 'DruxtEntity', when: `a field uses the ${name} formatter` }]),
  ),
}

/** The package each component's API page lives under. */
export const PACKAGES = {
  DruxtBlock: 'blocks',
  DruxtBlockRegion: 'blocks',
  DruxtEntity: 'entity',
  DruxtEntityForm: 'entity',
  DruxtMenu: 'menu',
  DruxtView: 'views',
  DruxtBreadcrumb: 'breadcrumb',
  DruxtRouter: 'router',
  DruxtSite: 'site',
}

/** The API page for a tier-1 component. */
export const pageFor = (name) => (PACKAGES[name] ? `/api/packages/${PACKAGES[name]}/components/${name}` : null)

/** The package of any tier: a tier-2 or -3 component belongs with its parent. */
export const packageOf = (name) =>
  PACKAGES[name] || PACKAGES[(CONTEXT_ONLY[name] || {}).parent] || PACKAGES[(SHIPPED_WRAPPERS[name] || {}).by] || null

/** The components that render on their own in a package, for its module page. */
export const liveComponentsOf = (pkg) => COMPONENT_NAMES.filter((name) => PACKAGES[name] === pkg)

/** Whether a component has a card of any tier, for its API page. */
export const knowsComponent = (name) => !!(COMPONENTS[name] || CONTEXT_ONLY[name] || SHIPPED_WRAPPERS[name])

/** The picker: three groups, only the first enabled. */



// A docs page's example link, read the same way the corpus reads it.
export { parseExampleLink } from '../lib/example-link.js'
