# Changelog

Changes to the druxtjs.org site are recorded here, newest first. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The site is deployed
rather than released, so there are no version numbers yet.

## Unreleased

### Added

- `npm run setup` and `npm run dev`, which bring up the backend and the
  frontend together, with `npm run login` for a one-time login link and
  `npm run docs:generate` for the generated reference pages.
- A dev container for VS Code, Codespaces and DevPod, set up the way the demo
  site's is.
- A README for contributors, with the site's banner, and `docs/backend.md` for
  the importer, page history and previews.
- The Druxt repository standard. Committed git hooks and commitlint check every
  commit. cspell, markdownlint, Prettier, ESLint, yamllint and Vale check the
  files. The pipeline also checks that no AI tool is credited, and scans for
  secrets with gitleaks and a detection canary.
- Issue and merge request templates for GitLab and GitHub, `CONTRIBUTING.md`,
  `AGENTS.md`, a Renovate policy and a toolchain pinned in `.mise.toml`.
- Tests for the private-host lint.

### Changed

- The root tooling runs on Node 16.20.1, the Node Nuxt 2 builds with, and
  `.nvmrc` is kept at the root only.
- A Drupal 11 backend replaces the Drupal 9 site. An importer seeds it from a
  pinned commit of the documentation in druxt.js, and saves each page's earlier
  versions as dated revisions.
- Drupal renders only administration. `default_admin` is the default theme, and
  the frontend reads the `druxtjs` theme's regions and blocks through the
  `druxtjs_org` consumer.

### Fixed

- The private-host lint read a private address written as an IPv4-mapped IPv6
  literal as a public one. It now reads the IPv4 address inside.
