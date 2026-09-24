# The Drupal backend

How the Drupal side of druxtjs.org is previewed, configured and seeded. The
[README](../README.md) covers running it.

## Status

Early. The content model and the importer are still being built.

## Previewing a page

**Preview** on a page's edit form opens the preview in the admin theme,
with three tabs. All three show the unsaved changes.

| Tab      | Shows                                                                            |
| -------- | -------------------------------------------------------------------------------- |
| Frontend | The frontend's preview page in a frame, at phone, tablet or full width           |
| Drupal   | The page's content in the admin theme, its paragraphs styled like the frontend's |
| JSON:API | The `jsonapi_node_preview` document, with the page's paragraphs included         |

The Frontend tab needs the frontend's preview URL in `settings.php`.
`{uuid}` and `{view_mode}` are filled in for each preview:

```php
$settings['druxt_docs_preview_url'] = '/druxt/node/preview?vm={view_mode}#/jsonapi/node/doc_page/{uuid}/preview';
```

Without it, the tab says the frontend preview isn't configured.

## Draft authoring and preview

A page can hold a draft. The editorial workflow on `doc_page` keeps the
published revision live while a later revision is a draft, and a signed-in
editor sees the draft on the page's own URL. The importer still seeds every
page published. Drafts are for changes prepared after a site is seeded.

### The workflow and who may use it

`content_moderation` runs an editorial workflow (draft, published, archived)
on `doc_page`, worked by the `contributor` and `editor` roles:

| Role          | May                                                                  |
| ------------- | -------------------------------------------------------------------- |
| `contributor` | Create a page, save a new draft, and see its own unpublished content |
| `editor`      | Edit any page, publish and archive, and see any unpublished content  |

Both roles also hold `grant simple_oauth codes`, which the OAuth authorize
step needs, and `create url aliases`, which a new page's path needs.

### Signing in

The frontend signs an editor in against the `druxtjs_org` consumer with the
authorization code grant and PKCE, no client secret, requesting the `editor`
scope. `druxt-auth` provides the callback route, the store and
`@nuxtjs/auth-next`; the site sets the strategy, because the authorize step
is a browser redirect that must name the origin a browser reaches Drupal on,
while the token exchange and the user lookup go through the frontend's own
origin. `/oauth/token` and `/oauth/userinfo` join `/jsonapi` on the proxy,
so the browser stays on its own origin, and Drupal does not need CORS to
sign an editor in.

A signed-in editor's requests send their bearer token on the server render
and in the browser, because Druxt's client and `@nuxtjs/auth-next` share one
axios instance. A "Sign in" control sits in the site header.

### Seeing the draft

The frontend asks JSON:API for the working copy of each page and paragraph
for a signed-in editor, so the page's own URL shows the latest draft. Anonymous requests never ask for the working copy, and Drupal refuses
a working-copy request from anyone without permission, so a draft is never
shown to the public. The stored-page cache is bypassed for a request that
presents the auth cookie, and that response is never written to the store, so
a draft cannot leak into a cached page.

### Authoring a page over JSON:API

`nuxt/scripts/author-page.mjs` writes a page and its paragraphs as a draft,
through Druxt's client. It takes one page of the intermediate representation:

```sh
# A new draft revision of an existing page:
node nuxt/scripts/author-page.mjs --document <ir.json> --uuid <page-uuid>

# A new page:
node nuxt/scripts/author-page.mjs --document <ir.json>
```

The script signs in the same way the site does: it opens the authorize page
in a browser and catches the redirect on a local listener at
`http://localhost:3939/callback`, a URI registered on the consumer. It holds
no secret. `DRUXT_TOKEN` supplies a token instead, for an unattended run.

It creates each paragraph with `DruxtClient.createResource`, then the page
with `createResource` (or `updateResource` for `--uuid`), referencing the
paragraphs by revision and setting `moderation_state` to `draft`. JSON:API
has no transaction, so on any failed write the script stops, exits non-zero
and prints every entity it created, leaving a list to clean up rather than a
search.

The writes need `jsonapi.settings` set to `read_only: false`, and a hook in
`druxt_docs` that allows a page's authors to
create its paragraph bundles, which Paragraphs otherwise permits only inside
an entity form. Creation is still gated by role and by the bearer token, so
an anonymous request cannot write.

The script does not upload media yet, so it refuses a page with an image
block before writing anything. A page whose only images are ones the seeded
site already holds can be authored once its markdown drops the image block.

### The local loop

The whole loop runs on one machine, with Drupal and the frontend on
different origins, as in production:

```sh
npm run setup                 # assemble, provision, import, start Drupal
npm run dev                   # the frontend, on another origin
# create an editor account, sign in through the header, then:
node nuxt/scripts/author-page.mjs --document <ir.json> --uuid <page-uuid>
```

The draft renders for the signed-in editor on the page's URL. An editor
publishes it from Drupal's content administration, and the anonymous site
then serves it.

## Export configuration after changing it

A change made through the admin UI or `drush` stays in the database until
you export it, from `drupal/`:

```sh
vendor/bin/drush config:export
git status -- config/sync
```

Content is not exported. The database is the source of truth, and the
importer seeds it from the pinned documentation.

## The documentation source

`docs-source.json` pins the documentation repository and the exact commit
the content is seeded from. Nothing here reads a branch. The content depends
only on that commit, the importer and the content model. On every pipeline,
CI builds from the pin into a throwaway site to prove the importer still
produces it.

Everything that reads the documentation is in this repository. `scripts/build-ir.mjs`
turns the pinned checkout into the intermediate representation the importer
consumes, and `scripts/survey-content.mjs` measures the same checkout into
`scripts/content-baseline.json`, the counts validation asserts against.

To move the pin, edit the `ref` in `docs-source.json` to the new commit and
rebuild against it:

```sh
npm ci                                   # the IR builder's one dependency
cd drupal
.devtools/assemble
.devtools/provision                      # an empty site
.devtools/import                         # fetch, build, import
cd ..
npm run survey:content                   # re-measure the baseline
```

Commit the pin together with the baseline.

`.devtools/import --check` is what CI runs. It refuses to build from
anything but the pinned commit, and it fails unless the site ends up holding
a page for every document the source produced, so a green pipeline means the
importer still turns the pinned commit into the whole corpus.

That page count alone would not be enough. It is compared against the
document count from the same build, so a builder that quietly produced fewer
documents would agree with itself. Before importing anything, the run also
checks the documents against the pinned checkout's tracked files and against
the committed baseline, which are two sources the builder does not control.
A page that leaves the corpus fails there, by name.

The importer is for seeding a site. Running it against a database an
editor has worked in would overwrite their changes.

## Page history

Each page is imported with its history. The IR builder reads every commit
that changed a page and follows the page through moves. Each distinct
version is kept. A commit that leaves a page as it was, such as a move, is
not a new version. The importer saves the versions as revisions, oldest
first, and then the current version as the last revision:

| Revision        | Value                                                           |
| --------------- | --------------------------------------------------------------- |
| Date            | The commit's author date, as `revision_timestamp` and `changed` |
| Log message     | The commit subject and short sha                                |
| Revision author | The account from the `docs_user` migration                      |
| Content         | Title, description and new paragraphs, parsed from that commit  |

History is only written when a page is created. `--update` changes the
current revision in place and never writes history again, so a re-run
cannot duplicate it. To rebuild the history after moving the pin, roll the
migrations back and import again. Rolling back deletes each page's earlier
revisions and the paragraphs only they used.

An earlier version cannot be edited, so it never fails the build:

- A fence in a language the model does not accept stays in the prose
  around it.
- An image stays an image only when the current pages use the same file
  with the same alt text. Any other image stays in the prose as markdown,
  and no media is created for it.
- Links are not checked.

The one check that does apply is the round-trip: an earlier version whose
blocks do not rebuild it stops the build, because its revision would not
say what the page said.
