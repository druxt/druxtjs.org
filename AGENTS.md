# Agent instructions

The [druxtjs.org](https://druxtjs.org) documentation site, with a Drupal 11
backend and a Nuxt frontend. It follows the Druxt repository standard for a
Nuxt application.

## Rules

- **This repository is public.** Nothing that resolves only on a private
  network may reach a tracked file: no internal URLs, hostnames, repository
  names or issue links, in any file, comments, patch descriptions and lock
  files included. `npm run lint:private` enforces the URL-shaped half of this
  and runs in the pipeline. It cannot catch an internal name written as prose,
  so that part is on you.
- **Conventional Commits**, and the same for merge request and pull request
  titles. A squash merge makes the title the commit subject, so a prose title
  breaks the next push to the target branch.
- **No AI tool is credited.** No co-author trailer naming an assistant, no
  generated-with footer, no session link, in commits, merge request
  descriptions or tracked files. The commit-msg hook rejects it locally, and
  `npm run lint:attribution` and the pipeline check the rest.
- **Prose is linted with Vale.** The ai-tells style covers the markdown a
  change touches, its commit messages and the merge request description. Run
  `npm run lint:prose:install` once, then `npm run lint:prose`.
- **Export configuration with the change that needed it.** Run
  `vendor/bin/drush config:export` in `drupal/` and commit
  `drupal/config/sync/`.
- **The database holds the content.** `drupal/content/` is a Tome export kept
  as a backup from before the database became canonical, and nothing writes to
  it. The importer seeds a site from the commit pinned in `docs-source.json`.
- **Move the pin with its baseline.** A new `ref` in `docs-source.json` needs
  `npm run survey:content` run again, and the two are committed together.
- **`github-slugger` stays at 1.5.0.** `druxt_docs` computes the table of
  contents with a PHP port of that version, and the import fails when the two
  disagree. Renovate is configured not to offer it.
- **Patches are public upstream diffs.** `drupal/composer.json` points each one
  at a drupal.org merge request or GitHub pull request `.diff` URL, and installs
  the patched package from source (`preferred-install`), so a diff that touches
  files the dist archive leaves out still applies. Commit
  `drupal/patches.lock.json` with it. composer-patches prints every patch
  description during `composer install`, so a description is public text too.
- **The coverage floor goes up, never down.** `npm run test:coverage` fails
  below 88% of lines, 87% of branches and 87% of functions in `scripts/`. It
  needs Node 22.8 or later, so CI runs it. `npm test` is the same suite on
  Node 16, without coverage.
- **The frontend's audit is report-only, and the root's blocks.** `npm run
lint:audit:nuxt` audits `nuxt/` with Yarn 4 in a scratch copy, because Yarn
  3.8.7's audit endpoint now answers 400. Nuxt 2's frozen tree cannot pass it.
- **PHP 8.3 is the floor.** The Composer lock is resolved against
  `config.platform.php` 8.3.0, and CI runs on 8.3.

## How Drupal serves the site

Drupal renders only administration. `default_admin` is both the default theme
and the admin theme. Druxt renders the public site.

The `druxtjs` theme holds only the frontend's regions and its 10 blocks, and
Drupal renders it only in the block region demo. The frontend reads the
theme's regions and settings from
`/jsonapi/decoupled/settings?consumerId=druxtjs_org`. decoupled_settings is
patched to expose the regions and to let a consumer select its theme, and the
`docs_consumer` migration gives the `druxtjs_org` consumer the `druxtjs` theme.

## Layout

| Path                                    | Purpose                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `nuxt/`                                 | The Nuxt 2 frontend on Yarn 3.8.7, copied from the docs app in druxt.js                |
| `drupal/`                               | The Drupal codebase, configuration and importer                                        |
| `drupal/.devtools/`                     | Provisioning scripts on PHP and SQLite, with no Docker                                 |
| `drupal/config/sync/`                   | Exported site configuration                                                            |
| `drupal/content/`                       | The Tome backup described above                                                        |
| `drupal/web/modules/custom/druxt_docs/` | Migrate plugins, the table of contents, hooks and Drush commands for the content model |
| `drupal/web/themes/custom/druxtjs/`     | The frontend's regions and blocks                                                      |
| `docs-source.json`                      | The documentation repository and commit the content is seeded from                     |
| `scripts/`                              | The IR builder, the corpus survey and its baseline, content validation, the host lint  |
| `tests/`                                | Node tests, and bash guardrail tests for `.devtools` and the scripts                   |
| `docs/`                                 | Notes on the backend: previews, configuration, the importer and page history           |
| `.devcontainer/`                        | The dev container, for VS Code, Codespaces and DevPod                                  |
| `.githooks/`                            | Committed hooks, enabled by `npm install`                                              |
| `.gitlab/scripts/`                      | The attribution and prose checks, copied from the standard                             |

## Commands

```bash
npm install                   # tooling and the IR builder's dependency, and enables the git hooks
npm run setup                 # assemble, provision, import the documentation, start Drupal
npm run dev                   # Nuxt dev server against that Drupal
npm run login                 # one-time login link
npm run docs:generate         # Modules, API and Components pages, built in .docs-source
npm run lint                  # every linter except prose
npm run lint:prose            # Vale, after `npm run lint:prose:install`
npm test                      # node tests
bash tests/start-guardrails.sh  # also import-guardrails.sh and validate-guardrails.sh
cd drupal && .devtools/assemble && vendor/bin/phpunit
```

`drupal/.devtools/README.md` covers provisioning, serving and importing.

## The frontend

`nuxt/` is copied from the docs app in druxt.js, and runs on Yarn 3.8.7 and
Node 16.20.1. `nuxt.config.js` reads only `DRUXT_BASE_URL`, so `npm run dev`
fills it from the `BASE_URL` that `.devtools/start` writes to `.env`.
`nuxt/content` is a gitignored link to the pinned documentation checkout in
`.docs-source`, and `npm run setup` creates it.

Its own lint setup comes with the frontend rework, so do not add Nuxt tooling
here ahead of it.
Until then ESLint, Prettier, markdownlint, cspell and Vale skip `nuxt/`. The
attribution and private-host checks still read every tracked file, `nuxt/`
included, because the repository is public.

## Toolchain

`.mise.toml` and `.nvmrc` pin Node 16.20.1, the Node Nuxt 2 builds with, and
PHP 8.4. CI tests PHP on 8.3, the floor the Composer lock is resolved
against. The root lint tooling is held at the last versions that run on Node 16,
and Renovate is configured not to offer newer ones.
