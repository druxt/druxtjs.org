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
password grant, through `druxt-auth`'s `drupal-password` strategy. The site's
own form sends the credentials to the frontend's server, which exchanges them
for a token, so there is no browser redirect. The same credentials open a
Drupal session first (`passwordSession`), because the editing screens are
Drupal's own forms proxied onto this origin. A sign-in asks for every role
scope, and Drupal grants only the roles the account holds. The site
configures one endpoint: `logoutToken`.

On the Drupal side, contrib modules provide the rest:

| Module                        | Route                       | Used for                                                          |
| ----------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `simple_oauth_password_grant` | `POST /oauth/token`         | The password grant itself                                         |
| `simple_oauth_revoke`         | `POST /oauth/revoke`        | Revoking the access and refresh tokens when an editor signs out   |
| `logout_token`                | `GET /session/logout/token` | Ending a Drupal session left open in the browser before a sign-in |

`nuxt/patches/druxt-auth-0.5.0.patch` carries `druxt-auth` changes that are
not released yet:

- Revoking both tokens at sign-out.
- Ending a session through `logout_token`.
- Checking `/user/login_status` when Drupal refuses a logout, so a session
  whose stored logout token has gone stale is still ended.
- The `hasAuthCookie` check the page cache uses.

Delete it, and pin the release, once a `druxt-auth` release includes them.

A signed-in editor's requests send their bearer token on the server render
and in the browser, because Druxt's client and `@nuxtjs/auth-next` share one
axios instance. A "Sign in" control sits in the site header.

### Staging in a workspace

Core Workspaces holds a set of changes off live until the workspace is
published, and publishing moves the whole set at once. That is how a release
of several pages, and embargoed content, waits. Editors may create, view and
edit any workspace, and publish one (`administer workspaces`, which core
requires for publishing).

A request chooses its workspace with the `X-Druxt-Workspace` header. The
`druxtjsorg` module applies it only when the account is signed in and may
view that workspace. The choice lasts the one request and leaves the
account's session alone. A reader's header is ignored. A write that names a
workspace it cannot have is refused with 403 rather than saved to live.
JSON:API needed these changes to be safe in a workspace:

| Piece                       | Why                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `WorkspaceHeaderSubscriber` | Simple OAuth resolves the path while the request is anonymous, fixing live for the whole request |
| `WorkspaceCacheHooks`       | JSON:API's normalization cache is not keyed by workspace, so reads in and out served each other  |
| `WorkspaceEntityResource`   | JSON:API refuses to update a non-default revision, so a second write in a workspace failed       |
| `LiveWorkingCopy`           | On live, the newest revision was a workspace's, so editors saw staged content as live's draft    |

Inside a workspace a page is saved published: it goes live with the
workspace. Core refuses to publish a workspace that holds a draft. A page
created in a workspace exists on live only as an unpublished placeholder,
which readers cannot see by id, path or collection.

A signed-in editor chooses a workspace under **Workspaces** in the
editor bar's Drupal menu. The choice is kept in the `druxt-workspace` cookie,
the bar names it on every page, and the frontend adds the header to the
editor's content requests on the server render and in the browser. A
request without the editor's token never carries it, and the stored-page
cache is bypassed for a signed-in editor as before. The page diff compares
the workspace's revision with live.

**Review changes** in the same menu opens `/workspace`, which lists the
pages the workspace has changed, newest first, each linking to the page with
its diff against live on. It reads JSON:API alone: with the workspace
active, pages filtered on `workspace`, the workspace their revision was made
in, are the ones it changed. The list links on to Drupal's own overview of
the workspace, where it is published.

Core lists every paragraph of a changed page in that overview as a row of
its own, which buries the pages. The `druxtjsorg` module keeps only the
entities that stand on their own, and marks the columns a phone can drop.

Drupal reads the same cookie for a signed-in editor, below the header, so its
own screens open in the workspace the frontend shows. Switching in Drupal's
toolbar writes the cookie back, and switching to live clears it.

A block's Edit opens the page's form with `?paragraph=<uuid>`, and the
`druxtjsorg` module opens that block's dialog in the Layout Paragraphs
builder. The change is saved with the page, so moderation, revisions and the
workspace all apply. Paragraphs Edit offers a paragraph form of its own, but
it saves the page from its default revision in its current moderation state,
which would publish a live page straight away and drop any draft.

### The local loop

The whole loop runs on one machine, with Drupal and the frontend on
different origins, as in production:

```sh
npm run setup                 # assemble, provision, import, start Drupal
npm run dev                   # the frontend, on another origin
# create an editor account, sign in through the header, then edit a page in Drupal
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
