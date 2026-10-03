# Druxt user

A Drupal user, rendered by [Druxt](https://druxtjs.org).

Drupal identifies a user three ways, and a decoupled site runs into each of
them: a uuid in JSON:API, the number in the path Drupal links to (`/user/2`),
and whoever is signed in. Only the first is one `DruxtEntity` can take, so
`DruxtUser` takes any of the three.

It reads the profile out of the resource too, so a site has something to draw
without asking Drupal for more. The name Drupal shows and the picture come
first, then the roles with their labels and the date the account was made. A
reader with no picture has their initials, and a site that asks for it can try
gravatar first.

## Install

```bash
npm install @druxt-contrib/user
```

```js
// nuxt.config.js
export default {
  buildModules: ['druxt', 'druxt-entity', '@druxt-contrib/user'],
}
```

`druxt-entity` renders the user in the default slot, so a site that replaces
that slot does not need it.

## Use

```vue
<DruxtUser :uuid="uuid" />
```

```vue
<!-- pages/user/_id.vue: the path Drupal links to -->
<DruxtUser :id="$route.params.id" />
```

```vue
<!-- whoever is signed in -->
<DruxtUser me />
```

```vue
<!-- your own markup -->
<DruxtUser me>
  <template #default="{ name, avatar, initials, roles, since }">
    <img v-if="avatar" :src="avatar" :alt="name" />
    <p v-else>{{ initials }}</p>
    <h1>{{ name }}</h1>
    <p>{{ roles.map((role) => role.label).join(', ') }}</p>
    <p>Here since {{ since }}</p>
  </template>
</DruxtUser>
```

| Prop           | What it is                                                   |
| -------------- | ------------------------------------------------------------ |
| `uuid`         | The user's JSON:API uuid                                     |
| `id`           | The user's number in Drupal, the one in `/user/2`            |
| `me`           | Render whoever is signed in                                  |
| `subjectKey`   | Where the signed-in user's uuid is, `sub` by default         |
| `include`      | What to load with the user, the picture and roles by default |
| `pictureField` | The image field, `user_picture` by default                   |
| `gravatar`     | Try gravatar for a reader with no picture, off by default    |
| `gravatarSize` | The size to ask gravatar for, 96 by default                  |
| `mode`         | The Drupal display mode, `default` by default                |
| `type`         | The resource type, `user--user` by default                   |

The wrapper component and the default slot both receive `{ user, name, uuid,
avatar, picture, initials, roles, since, type, mode }`.

## The gravatar

Off by default. A gravatar is a request to a third party, and that request
tells the third party that this site rendered this person, to this browser, at
this moment. A site decides whether to make it, so `gravatar` is opt in:

```vue
<DruxtUser :id="$route.params.id" gravatar />
```

The address is hashed in the browser with SHA-256 and only the hash is sent,
so the address itself never leaves the site. A hash does not make the address
private, because anyone who can guess an address can hash it. The request asks
gravatar for `d=404`, so a reader with no gravatar falls back to their
initials rather than to a stranger's silhouette.

Initials are the usual case in any event. Drupal sends an email address only
to a reader allowed to see it, which is the account's owner and an
administrator, so on most sites there is no address to hash and nothing is
requested.

The reading is exported on its own, for a site building another service's
address: `emailHash(email, subtle)` and `gravatarUrl(hash, { size })`.

## Who may see a profile

Drupal decides. A site that has not granted **View user information** shows an
anonymous reader nothing, and `user` is undefined rather than an error: a rule
the backend enforces is not a failure for the frontend to report. Grant the
permission to the roles that should see profiles, or render the page only to
those who may.

`me` reads the signed-in user's uuid from the OpenID Connect `sub` claim, which
is where Drupal's Simple OAuth puts it. A site whose authentication says it
another way passes `subjectKey`.

## Component resolution

The wrapper is resolved by Druxt's naming cascade, most specific first:

1. `DruxtUser[ResourceType][Mode]`, such as `DruxtUserUserUserTeaser`
2. `DruxtUser[Mode]`, such as `DruxtUserTeaser`
3. `DruxtUserDefault`

See [component resolution](https://druxtjs.org/explanation/component-resolution).

## Development

```bash
npm install            # dependencies, and enables the git hooks
npm run build          # build the module
npm test               # unit tests, coverage floor enforced
npm run lint           # every linter except prose
npm run lint:prose     # Vale, after `npm run lint:prose:install` once
npm run example:setup  # Drupal 11 backend on SQLite, then the example's dependencies
npm run example:dev    # the example on http://localhost:3000
npm run test:e2e       # Playwright against the example, backend up
```

`.mise.toml` pins the toolchain and defines the same commands as tasks, so with
[mise](https://mise.jdx.dev) installed, `mise run ci` runs what the pipeline
runs.

This module follows the Druxt repository standard, and was started from
[module-template](https://github.com/druxt/module-template).

## Things worth knowing before you change them

**The coverage floor goes up, never down.** It is measured from the current
tests, not aspirational. If a change drops coverage, the change needs a test.

**Never regenerate visual baselines locally.** Use the manual `visual:update`
pipeline job. Chromium renders differently on ARM, so a baseline generated on an
Apple silicon machine is a permanent false diff for everyone else.

**Title your pull requests like commits.** This repository squash-merges, so the
title becomes the commit subject. A prose title passes review and then breaks
the next push to the target branch.

**Nothing private in a tracked file.** This repository is public.
`npm run lint:private` fails on a URL that only resolves on a private network,
and runs in CI.

## Licence

[MIT](LICENSE)
