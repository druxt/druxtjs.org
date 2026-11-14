# DruxtCanvas

[![npm](https://img.shields.io/npm/v/@druxt-contrib/canvas)](https://www.npmjs.com/package/@druxt-contrib/canvas)
[![npm@dev](https://img.shields.io/npm/v/@druxt-contrib/canvas/dev)](https://www.npmjs.com/package/@druxt-contrib/canvas/v/dev)
[![CI](https://github.com/druxt-contrib/druxt-canvas/actions/workflows/ci.yml/badge.svg?branch=0.x)](https://github.com/druxt-contrib/druxt-canvas/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/druxt-contrib/druxt-canvas/branch/0.x/graph/badge.svg)](https://codecov.io/gh/druxt-contrib/druxt-canvas)
[![Known Vulnerabilities](https://snyk.io/test/github/druxt-contrib/druxt-canvas/badge.svg?targetFile=package.json)](https://snyk.io/test/github/druxt-contrib/druxt-canvas?targetFile=package.json)
[![Discord](https://img.shields.io/discord/753866667590680587?label=discord&logo=discord&logoColor=white)](https://discord.druxtjs.org)

> Drupal Canvas pages for Druxt.

DruxtCanvas renders the pages editors build in
[Drupal Canvas](https://www.drupal.org/project/canvas) in a
[Druxt](https://druxtjs.org) site, from Drupal's JSON:API. Drupal keeps
deciding what goes on the page. Your Nuxt components decide how it looks:
each Canvas component renders through a Druxt wrapper component named after
it, and every part themes through the Druxt component suggestion system.

## Features

- Vue.js components:
  - **DruxtCanvas** renders a Canvas page by UUID, or from a resource you already have
  - **DruxtCanvasComponent** renders one Canvas component instance through its wrapper component
- **Druxt Router** integration, so a Canvas page renders at its own path with no page of your own, and the front page can be one
- **Block mappings** that render Canvas's menu, views and breadcrumb blocks as DruxtMenu, DruxtView and DruxtBreadcrumb
- **Page head** from the page's `metatag` field

---

## Installation

1. Install the package:

   ```sh
   npm i @druxt-contrib/canvas
   ```

2. Add the module to `nuxt.config.js`, after the Druxt modules it works with:

   ```js
   export default {
     modules: [
       'druxt-entity',
       'druxt-router/nuxt',
       'druxt-menu',
       'druxt-views',
       '@druxt-contrib/canvas',
     ],
     druxt: {
       baseUrl: 'https://drupal.example.com',
     },
   }
   ```

   `druxt-entity` and `druxt-router` route a Canvas page's path to it.
   `druxt-menu` and `druxt-views` are optional: leave one out, and its blocks
   render as any Canvas component without a wrapper does.

Every Canvas page path now renders its Canvas tree. To render a page anywhere
else:

```vue
<DruxtCanvas uuid="efff9394-e546-4d64-98e8-295c92367d52" />
```

In a page that has a `fetch()` of its own, such as a front page in
`pages/index.vue`, wrap it in an element. Nuxt 2 keeps each component's fetch
key on its root element, and two components that share one root swap their
data on hydration: the page renders on the server, then empties in the
browser.

```vue
<template>
  <div>
    <DruxtCanvas uuid="efff9394-e546-4d64-98e8-295c92367d52" />
  </div>
</template>
```

### Development releases

A change merged to `0.x` with a changeset is published under the `dev` tag:

```sh
npm i @druxt-contrib/canvas@dev
```

These are unreleased builds. See [RELEASING.md](RELEASING.md).

### Drupal

1. Install [Canvas](https://www.drupal.org/project/canvas), which needs Drupal
   11.3 or later, JSON:API and
   [Decoupled Router](https://www.drupal.org/project/decoupled_router).
   [Drupal CMS](https://www.drupal.org/drupal-cms) has Canvas already.
2. Install the [Druxt module](https://www.drupal.org/project/druxt), and give
   the "**access druxt resources**" permission to the roles your site reads
   as. For the menu and views blocks, also install
   [JSON:API Menu Items](https://www.drupal.org/project/jsonapi_menu_items) and
   [JSON:API Views](https://www.drupal.org/project/jsonapi_views).
3. Check that a published Canvas page can be read:
   `curl https://drupal.example.com/jsonapi/canvas_page/canvas_page`.

The Druxt module's permission reads its list of resources: the configuration
Druxt builds from, such as `entity_view_display--entity_view_display`,
`field_config--field_config`, `menu--menu`, `menu_link_content--menu_link_content`
and `view--view`. A Canvas page, `canvas_page--canvas_page`, is not on that list
and does not need to be. It is a content entity, read under its own access like
a node: on Drupal CMS, anonymous visitors can read published Canvas pages.

Neither Canvas's headless module nor Custom Elements is needed.

---

## Vue.js components

### DruxtCanvas

Renders a Canvas page: its `components` field is built into a tree, and each
component instance renders as a `DruxtCanvasComponent`.

```vue
<DruxtCanvas :uuid="uuid" />
<DruxtCanvas :value="resource" />
```

The page's title and meta tags come from its `metatag` field when the page is
the current route, or when the `metatags` prop is `true`.

Wrapper components:

1. `DruxtCanvas[EntityType][Bundle]`, such as `DruxtCanvasCanvasPageCanvasPage`
2. `DruxtCanvas[EntityType]`, such as `DruxtCanvasCanvasPage`

A page wrapper receives `entity`, the page resource, and `tree`, its component
instances. Its `default` slot renders the components, and each root component
has a slot named by its UUID:

```vue
<template>
  <main>
    <h1>{{ entity.attributes.title }}</h1>
    <slot />
  </main>
</template>

<script>
export default {
  props: {
    entity: { type: Object, required: true },
    tree: { type: Array, default: () => [] },
  },
}
</script>
```

### DruxtCanvasComponent

Renders one Canvas component instance. `DruxtCanvas` renders it for each
instance in the tree, so you don't use it directly.

---

## Theming a Canvas component

Every Canvas component instance renders through the first wrapper component
that exists, most specific first, named from its Canvas component ID. For
Mercury's heading, `sdc.mercury.heading`:

1. `DruxtCanvasSdcMercuryHeading`
2. `DruxtCanvasSdcMercury`
3. `DruxtCanvasSdc`
4. `DruxtCanvasDefault`

The pattern is `DruxtCanvas[Source][Provider][Name]`: a code component
`js.druxt_card` is `DruxtCanvasJsDruxtCard`, and the main menu block
`block.system_menu_block.main` is `DruxtCanvasBlockSystemMenuBlockMain`. With
a langcode, each name also has a langcode variant, such as
`DruxtCanvasSdcMercuryHeadingEn`.

The instance's inputs are the wrapper's props, in camelCase (`heading_text` is
`headingText`), and `canvas` holds the instance itself: `uuid`, `componentId`,
`label`, `inputs` and `slots`. Declare the inputs you use as props.
`DruxtCanvasComponentMixin` keeps the rest out of the markup.

The inputs are the values Canvas resolved, from each item's `inputs_resolved`.
Canvas passes an HTML input through its `canvas_html_block` text format first,
so a wrapper may render it with `v-html`. The stored `inputs` are not read:
their markup is unfiltered.

Each Canvas slot is a Vue slot of the same name. The `default` slot is the
component's default output.

### Default output

Without a wrapper component, a Canvas component renders its default output, as
every Druxt module does. For a Canvas component that is the content of its
Canvas slots in order, much as DruxtEntity renders its fields without one, so a
page stays readable while you write its wrappers.

A Canvas component with no slots, such as a heading, has no default output. In
development, Druxt's debug message says so and names the wrapper components it
would accept. Create a Druxt theme component to render it. Production renders
an empty element.

A Canvas page without a page wrapper renders its default output too: its
component tree.

### A wrapper for a Twig component (SDC)

JSON:API sends a Twig component's inputs, not its markup, so a Druxt site writes
a Vue wrapper for each single-directory component it uses. For Mercury's
heading, `components/druxt/canvas/sdc/mercury/Heading.vue`:

```vue
<template>
  <component :is="`h${level}`">{{ headingText }}</component>
</template>

<script>
import { DruxtCanvasComponentMixin } from '@druxt-contrib/canvas'

export default {
  mixins: [DruxtCanvasComponentMixin],
  props: {
    headingText: { type: String, default: '' },
    level: { type: Number, default: 2 },
  },
}
</script>
```

A component with slots renders them by name, such as Mercury's section:

```vue
<template>
  <section>
    <header><slot name="header_slot" /></header>
    <div class="columns"><slot name="main_slot" /></div>
  </section>
</template>
```

### Naming the file

Nuxt 2 names a component from its folders and its file name, but drops the
folders when the file name starts with a word they contain:
`components/druxt/canvas/js/DruxtCard.vue` registers as `DruxtCard`, not
`DruxtCanvasJsDruxtCard`. For a component whose name starts that way, use the
full name as the file name: `components/DruxtCanvasJsDruxtCard.vue`.

### Menu and views blocks

Canvas places Drupal's menu and views blocks as components, with their settings
as inputs. With druxt-menu and druxt-views installed they render with no
wrapper of your own:

| Canvas component ID                  | Renders           | Props                                                         |
| ------------------------------------ | ----------------- | ------------------------------------------------------------- |
| `block.system_menu_block.<menu>`     | `DruxtMenu`       | `name` from the ID, `depth` from the block (0 is every level) |
| `block.views_block.<view>-<display>` | `DruxtView`       | `viewId` and `displayId` from the ID                          |
| `block.system_breadcrumb_block`      | `DruxtBreadcrumb` |                                                               |

The block label shows when the block displays it. A more specific wrapper
replaces a mapping, such as `DruxtCanvasBlockSystemMenuBlockMain` for the main
menu. A mapping whose Druxt module is not installed is left out of the build.

### Canvas pages in a view

A view or a reference that lists Canvas pages renders each one as its title,
linked to the page (`DruxtEntityCanvasPage`). Only the `full` view mode, which
DruxtRouter uses, renders the Canvas tree (`DruxtEntityCanvasPageFull`). A page
that holds a view listing itself is not rendered inside itself.

---

## Limits

This version renders published Canvas pages. It does not do:

- **Drafts and in-editor preview.** Only Canvas's headless module provides
  them, and its Nuxt SDK needs Nuxt 4.
- **Content templates**, the Canvas trees for a content type's view mode with
  inputs bound to the node's fields. Nodes keep rendering through DruxtEntity.
- **Anything but pages.** Page regions and patterns are not rendered.
- **Twig components' markup.** JSON:API sends a single-directory component's
  inputs only. Write a wrapper for each one you use, as above.
- **Menu blocks that start below the first level** (`level` above 1): DruxtMenu
  has no active trail root. Write a wrapper for them.
- **A views block's `items_per_page` override**: DruxtView uses the display's
  own pager.
- **Per-component access.** Canvas applies a block's own access when it renders
  it, and JSON:API does not.
- **Lists of objects as an input.** Canvas offers a list of strings (`type:
array` with `items: string`), which arrives in the wrapper as an array prop,
  and no list of objects. Use child components in a slot instead.

### Canvas 1.12.0 and the Druxt schema build

Canvas 1.12.0 answers HTTP 500 to the second page of any JSON:API collection of
configuration entities. druxt-schema reads every `entity_view_display` and
`entity_form_display` page by page while `nuxt build` runs, and a Drupal CMS
site has more than one page of displays, so the build stops with
`[fatal] 500: Internal Server Error`.

The defect is in Canvas, and this module does not change it. Until Canvas fixes
it, cast the page offset to an integer in
`canvas/src/CoreBugFix/ConfigEntityQuery.php`, with a Composer patch for
example, or build against a site whose collections fit on one page.

---

## Development

```bash
npm install            # dependencies, and enables the git hooks
npm run build          # build the module
npm test               # unit tests, coverage floor enforced
npm run lint           # every linter except prose
npm run lint:prose     # Vale, after `npm run lint:prose:install` once
npm run example:dev    # the example on http://localhost:3000
npm run test:e2e       # Playwright against the generated example, backend up
```

`.mise.toml` pins the toolchain, Node 16 for Nuxt 2, and defines the same
commands as tasks, so with [mise](https://mise.jdx.dev) installed,
`mise run ci` runs what the pipeline runs.

The unit tests read JSON:API and Decoupled Router responses saved from a Drupal
CMS 2.2.9 site with Canvas 1.12.0, in `test/fixtures`.

### The example application

`example/` holds a Nuxt application that renders Canvas pages through wrapper
components a site would write, and its Drupal 11 backend with Canvas. See
`example/README.md`.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) covers getting set up, what to run before
you push, commit messages, the coverage floor and the visual baselines.
[AGENTS.md](AGENTS.md) sets out the same rules for a coding agent working in
this repository.

## Links

- [DruxtJS](https://druxtjs.org)
- [Drupal Canvas](https://www.drupal.org/project/canvas)
- [Community Discord server](https://discord.druxtjs.org)

## Licence

[MIT](LICENSE), except `example/drupal/`, the example Drupal site, which is
[GPL-2.0-or-later](example/drupal/LICENSE.txt) like Drupal itself.
