# DruxtNodePreview

Renders Drupal node previews in a [Druxt](https://druxtjs.org) frontend, so an
editor pressing Preview in Drupal sees the unsaved content rendered by the real
frontend, paragraphs included.

Works with two Drupal modules:

- [JSON:API Node Preview](https://www.drupal.org/project/jsonapi_node_preview)
  serves the unsaved preview over JSON:API.
- Consumer Node Preview turns Drupal's preview screen into Frontend, Drupal and
  JSON:API tabs, and frames this module's page in the Frontend tab.

## How it works

1. The editor presses Preview in Drupal. The Frontend tab frames this
   module's page, with the JSON:API preview endpoint in the URL fragment, so
   it never reaches any server log.
2. The page reads the fragment and fetches the endpoint with the editor's
   Drupal session.
3. It seeds the Druxt store with the document and its includes, then renders
   the node through a themeable `DruxtNodePreview` wrapper and `DruxtEntity`.

Because the store is seeded before `DruxtEntity` resolves, the unsaved preview
data renders through the same components as the live site.

## Install

```sh
npm install @druxt-contrib/node-preview
```

It needs Druxt 0.25 and Druxt Entity 0.29 or later. Until they are released,
install their builds from the `dev` tag, for example `npm install druxt-site@dev`.

```js
// nuxt.config.js
export default {
  modules: [
    '@druxt-contrib/node-preview',
    'druxt-site',
  ],
  druxt: {
    baseUrl: 'https://drupal.example.com',
    nodePreview: {
      // The preview page's path. This is the default.
      path: '/druxt/node/preview',
      // Relationships to add to the endpoint's own include. Consumer Node
      // Preview already includes a node's paragraphs, so add what they
      // reference, for example 'field_content.field_media'. JSON:API rejects
      // a path the previewed type does not have, so key paths that only some
      // bundles have by type: { 'node--page': ['field_content.field_media'] }.
      include: [],
      // Origins the preview may come from, besides this site and the
      // baseUrl above. The endpoint arrives in the URL fragment, which any
      // link can set, so the page refuses every other origin.
      origins: [],
      // Nuxt layouts the preview may render in, picked with ?layout=.
      // List the same names for the target in Drupal: on the consumer, or
      // on a settings.php target.
      layouts: [],
    },
  },
}
```

The page's route is named `druxt-node-preview`. The name is stable, so a site
can hook the route.

In Drupal, add a Consumer Node Preview target that points at the page:

```text
https://frontend.example.com/druxt/node/preview?vm=[view_mode]&layout=[layout]#[jsonapi_node_preview_path]
```

`vm` carries the view mode, and `layout` the layout picked in the preview's
Layout select. The fragment carries the endpoint.

The page renders in the layout `layout` names, but only when `layouts` lists
it. Any other name, or none, gives the default layout. So a preview URL
cannot put the page in another of the site's layouts. A bare layout, with the
site's type and spacing but no header or footer, suits a preview of content
that sits inside other pages. `$druxtNodePreview.layout(name)` makes the same
check, for a site that picks layouts elsewhere.

The Layout select and the `[layout]` token need a Consumer Node Preview build
with preview layouts. With an older one, the literal `[layout]` arrives, and
the page uses the default layout.

## Theming the preview

A live page often wraps the node in more than `DruxtEntity`: a title, a
header, a prose container. The preview gets the same through a wrapper
component, picked like any Druxt wrapper. For a `node--doc_page` previewed in
`full`, the first of these that exists is used:

1. `DruxtNodePreviewDocPageFull`
2. `DruxtNodePreviewDocPage`
3. `DruxtNodePreviewDefault`

If none of them exists, the node renders in Druxt's plain wrapper.

A wrapper receives whichever of these props it declares:

- `document`: the whole JSON:API preview document.
- `entity`: the previewed resource, with `attributes` such as the title.
- `mode`, `type` and `uuid`.

Its default slot renders the node with `DruxtEntity`:

```vue
<!-- components/druxt/node-preview/DocPageFull.vue -->
<template>
  <article class="prose">
    <h1>{{ entity.attributes.title }}</h1>
    <slot />
  </article>
</template>

<script>
export default {
  // The props it does not declare would otherwise land on <article>.
  inheritAttrs: false,
  props: {
    entity: { type: Object, required: true },
  },
}
</script>
```

A wrapper named by bundle alone, such as `DruxtNodePreviewDocPage`, applies
to every view mode. So page chrome such as a title belongs in the
`<Bundle>Full` wrapper, as above, or behind the `mode` prop.

## Components that fetch their own data

The preview seeds the store, so a component that reads the store renders the
unsaved data. A component that fetches its data again, for example paragraphs
at a revision, would replace the preview with saved content. The plugin
registers a `druxtNodePreview` store module for this. Skip the refetch while a
preview is active:

```js
if ((this.$store.state.druxtNodePreview || {}).active) return
```

The flag does not leak into other pages. Leaving the preview route flushes
every resource the preview seeded from the Druxt store and clears the flag,
before the next page loads. That page then fetches and renders the saved
content.

This needs Druxt 0.25 or later, for the `druxt/flushResource` mutation.

## The request

The page fetches through the Druxt client, `$druxt.axios`, with credentials.
So the site's own request interceptors apply, such as a workspace header, and
the editor's session cookie goes with the request.

An endpoint given as a path stays a path. The Druxt client resolves it against
its own base URL, and interceptors that decide by path still match it. That
suits a frontend that proxies Drupal on its own origin, with Druxt's
`proxy: { api: true }`: no CORS, and the session cookie stays first party.
Without the proxy, a path goes to Drupal's origin, as an absolute endpoint on
another origin does. Then Drupal needs CORS with `supportsCredentials: true`
for the frontend origin, and a `SameSite=None` session cookie.

Paragraphs come through unsaved only with the JSON:API Node Preview include
resolver fixes from https://www.drupal.org/i/3367724, until a release has
them. `example/drupal/composer.json` applies them with composer-patches.

## Server rendering

The page only works in the browser. The fragment never reaches the server, so
a server render shows "Loading preview…" and the browser fills it in. On a
statically generated site, the page sets the listed layout once it is in the
browser, because the generated page has the default one.

## Vendoring

The package ships its built `dist`. A site that vendors a copy instead of
installing it must commit `dist` too, even when the site ignores `dist`
folders.

## Example

See `example/` for a paired Drupal and Nuxt setup.
