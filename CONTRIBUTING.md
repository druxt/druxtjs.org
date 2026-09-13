# Contributing

Thanks for helping. This repository is the [druxtjs.org](https://druxtjs.org)
documentation site, with a Drupal backend and a Nuxt frontend. The backend
holds the content model, the importer that seeds it, and the site's
configuration.

## Repositories

| Change                                                                                            | Where it goes                                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| The text of a documentation page                                                                  | [druxt/druxt.js](https://github.com/druxt/druxt.js), where the pages are written. This site seeds its content from a pinned commit of that repository |
| A Druxt Nuxt module                                                                               | [druxt/druxt.js](https://github.com/druxt/druxt.js)                                                                                                   |
| The Druxt Drupal module                                                                           | [drupal.org/project/druxt](https://www.drupal.org/project/druxt)                                                                                      |
| The frontend, the content model, the importer, the editing experience or the site's configuration | This repository. Open an issue or a pull request on [druxt/cms.druxtjs.org](https://github.com/druxt/cms.druxtjs.org)                                 |

## Getting set up

The [README](README.md#get-involved) has three ways to run the site: a dev
container, mise, or by hand. Each ends with the same commands:

```bash
npm install
npm run setup
npm run dev
```

`npm install` also enables the git hooks. If you skipped install scripts, run
`npm run hooks:install`, or the hooks stay on disk doing nothing.

[docs/backend.md](docs/backend.md) covers the importer, page history and
previews.

## Before you push

```bash
npm run lint           # every linter except prose
npm test               # node tests
npm run lint:prose     # Vale, after `npm run lint:prose:install` once
```

The pre-commit hook runs the first two. The pipeline also runs the guardrail
tests in `tests/`, PHPUnit in `drupal/`, commit message and YAML lint, a
secret scan, and a provision and import from the pinned documentation. To run
PHPUnit yourself, run `vendor/bin/phpunit` in `drupal/` after
`.devtools/assemble`.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org). The commit-msg
hook checks them, and the pipeline checks every commit in the merge request.

Title a pull request the same way. A squash merge makes the title the commit
subject, so a prose title passes review and then breaks the next push to the
target branch.

## Configuration

A change made through the admin UI stays in the database until you export it.
Run `vendor/bin/drush config:export` in `drupal/`, and commit
`drupal/config/sync/` with the change that needed it.

## What not to put in a file

This repository is public. Nothing that resolves only on a private network may
reach a tracked file, whether as a URL, in a comment or in a patch
description. `npm run lint:private` checks this and runs in the pipeline. To
cite something internal, describe it without the URL. A public equivalent,
such as a drupal.org issue, can be linked instead.

No commit, pull request description or file may credit an AI tool as an author
or co-author. `npm run lint:attribution` checks this.
