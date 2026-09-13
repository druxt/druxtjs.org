/**
 * What the live example card knows about each Druxt component.
 *
 * A stopgap until docgen emits this per component: the props a reader can
 * change, where a select's options come from, and what each select prefers
 * on its own. The card reads nothing else.
 */

/**
 * Backends the card can render against. Both are proxied onto this origin:
 * `api` is where the option lists come from; a runtime's client is told the
 * backend's own `baseUrl` (this site's when unset) and sends through
 * `proxyRoot`.
 */
export const BACKENDS = {
  site: { label: 'Druxtjs.org', api: '/jsonapi', baseUrl: null, proxyRoot: '', nodeBundle: 'doc_page' },
  umami: {
    label: 'Umami demo',
    api: '/umami/jsonapi',
    baseUrl: 'https://demo-api.druxtjs.org',
    proxyRoot: '/umami',
    nodeBundle: 'recipe',
    storybook: 'https://storybook.umami.demo.druxtjs.org/',
    storybookLabel: 'Umami',
  },
}

const get = async (api, path) => {
  const response = await fetch(`${api}${path}`, { headers: { Accept: 'application/vnd.api+json' } })
  if (!response.ok) throw new Error(`${response.status} from ${path}`)
  return response.json()
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
    const { data } = await get(api, '/entity_view_display/entity_view_display?filter%5Bstatus%5D=1&fields%5Bentity_view_display--entity_view_display%5D=targetEntityType')
    return [...new Set(data.map((o) => o.attributes.targetEntityType))].sort().map((t) => ({ value: t, label: t }))
  },

  bundles: async (api, { entityType }) => {
    if (!entityType) return []
    const { data } = await get(api, `/entity_view_display/entity_view_display?filter%5Bstatus%5D=1&filter%5BtargetEntityType%5D=${entityType}&fields%5Bentity_view_display--entity_view_display%5D=bundle`)
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
  // the language module exposes none, and offers none.
  languages: async (api) => {
    try {
      const { data } = await get(api, '/configurable_language/configurable_language?fields%5Bconfigurable_language--configurable_language%5D=drupal_internal__id,label,locked')
      return data.filter((o) => !o.attributes.locked).map((o) => ({ value: o.attributes.drupal_internal__id, label: `${o.attributes.label} (${o.attributes.drupal_internal__id})` }))
    } catch (e) {
      return []
    }
  },

  // Paths the router can resolve: this backend's content, by title.
  paths: async (api, deps, backend) => {
    const bundle = (backend || {}).nodeBundle || 'page'
    const { data } = await get(api, `/node/${bundle}?page%5Blimit%5D=50&sort=title&fields%5Bnode--${bundle}%5D=title,path`)
    return data
      .filter((o) => (o.attributes.path || {}).alias)
      .map((o) => ({ value: o.attributes.path.alias, label: `${o.attributes.title} (${o.attributes.path.alias})` }))
  },

  displays: async (api, { viewId }) => {
    if (!viewId) return []
    const { data } = await get(api, `/view/view?filter%5Bdrupal_internal__id%5D=${viewId}`)
    const displays = ((data[0] || {}).attributes || {}).display || {}
    return Object.keys(displays).map((d) => ({ value: d, label: d }))
  },
}

/** The frontend theme: this site's own, or the Umami demo's. */
const siteTheme = (card) => (card.backend === 'umami' ? 'umami' : ((card.$config || {}).decoupledTheme || {}).default)

/** One value per backend: what demos best on each. */
const perBackend = (site, umami) => (card) => (card.backend === 'umami' ? umami : site)

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
    props: [
      { name: 'uuid', type: 'string', control: 'select', source: 'blocks', required: true, prefer: perBackend(/branding/, /umami_banner_recipes/), description: 'The block entity UUID.' },
    ],
  },

  DruxtBlockRegion: {
    story: 'druxt-blocks-druxtblockregion--default',
    args: [],
    chain: {
      label: 'theme, region',
      description: 'Each one narrows the next.',
      steps: [
        { name: 'theme', source: 'themes', required: true, prefer: siteTheme },
        // The header on both: a banner region's blocks show only on their own pages.
        { name: 'name', source: 'regions', needs: ['theme'], prefer: 'header' },
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
      { name: 'name', type: 'string', control: 'select', source: 'menus', default: 'main', prefer: (card) => (card.backend === 'umami' ? 'main' : 'docs'), description: 'The menu machine name.' },
      { name: 'minDepth', type: 'number', control: 'number', default: 0, description: 'The minimum depth to render.' },
      { name: 'maxDepth', type: 'number', control: 'number', default: null, description: 'The maximum depth to render.' },
    ],
  },

  DruxtView: {
    story: 'druxt-views-druxtview--default',
    args: [],
    // JSON:API Views is not on this site's Drupal yet.
    backends: { umami: true, site: 'needs JSON:API Views on that Drupal' },
    chain: {
      label: 'viewId, displayId',
      description: 'Each one narrows the next.',
      steps: [
        { name: 'viewId', source: 'views', required: true, prefer: (card) => (card.backend === 'umami' ? 'recipes' : 'frontpage') },
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
    props: [
      { name: 'path', type: 'string', control: 'select', source: 'paths', required: true, prefer: perBackend(/getting-started/, /deep-mediterranean-quiche/), description: 'The path to resolve; the current route when unset.' },
    ],
  },

  DruxtSite: {
    story: 'druxt-site-druxtsite--default',
    args: [],
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

