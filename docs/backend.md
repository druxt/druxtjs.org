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
