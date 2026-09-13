# Changelog

Changes to the druxtjs.org site are recorded here, newest first. The format is
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and, from the first
numbered version on, the site follows [Semantic Versioning](https://semver.org/).
Versions count up from 0.9.0 toward 1.0.0, which is reserved for the launch of
Druxt 1.0.0.

## Unreleased

The relaunch of the site: what runs on Lagoon today. It ships as **0.9.0**,
the first numbered version, once the relaunch stack merges.

### Added

- The site runs on Lagoon as one environment, Drupal beside Nuxt. Nuxt
  serves pre-rendered pages first and renders the rest live, behind a
  starting page while the app builds; `?live=1` renders past the store.
  `docs/hosting.md` covers a deployment.
- A live component playground at `/playground`, and a "Try it" card on
  each module and component reference page. Every Druxt component renders
  against this site's Drupal, the Umami demo, or a reader's own Drupal,
  which the card probes for the modules each component needs. The props
  are the controls, the requests are listed, the markup can be copied, and
  the URL holds the card's state so it can be shared.
- `sitemap.xml`, `llms.txt` and `llms-full.txt`, written when the server
  starts, and share cards for every page.
- Form widgets for the playground's entity forms: text, number, options,
  radios and checkboxes, language, references, media, path and moderation.
- Redirects for the old guide and reference paths, and for the package
  subdomains.
- A Storybook service beside the site, with stories for the `dui`
  components and the ones Druxt writes from the backend. Production serves it
  at `storybook.druxtjs.org`; the footer and the playground link to the
  environment's own.

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

- Each page asks Drupal only for the fields its displays render, and each
  menu only for what a menu needs. The inline page state is about a fifth
  smaller.
- Druxt's components load with the page rather than as chunks, so the
  server-rendered markup hydrates instead of being rendered again.
- A request for a page in another letter case is redirected to the alias
  Drupal resolves; a query string other than `live=1` gets the stored page.
- The page footer no longer offers to edit the page in druxt.js. Pages are
  edited in Drupal, and the database is the source of truth.
- Module pages list their "Try it" and API reference sections in the table
  of contents. Component reference pages put the card after the reference.

- The root tooling runs on Node 16.20.1, the Node Nuxt 2 builds with, and
  `.nvmrc` is kept at the root only.
- A Drupal 11 backend replaces the Drupal 9 site. An importer seeds it from a
  pinned commit of the documentation in druxt.js, and saves each page's earlier
  versions as dated revisions.
- Drupal renders only administration. `default_admin` is the default theme, and
  the frontend reads the `druxtjs` theme's regions and blocks through the
  `druxtjs_org` consumer.

### Fixed

- Drupal media images render with the alt text set on their reference, not
  their filename as a heading.
- The page body no longer re-renders in the browser after hydration, and the
  docs menu is no longer fetched again on every page.
- The playground's controls are labelled, show their focus, and stay at 16
  px on tablets. Its backend reasons are text rather than a title attribute.

- The private-host lint read a private address written as an IPv4-mapped IPv6
  literal as a public one. It now reads the IPv4 address inside.

## History

Before numbered versions, this repository lived one life already. The original
site was never released or tagged, so its story is told here rather than under
a version it never had.

- **November 2020** — the repository was created as druxtjs.org's home, and
  held little more than its issue templates for almost a year.
- **October 2021** — the first site arrived (#3, merged as #4): a Drupal 9
  site with the Druxt module configured, DDEV and Gitpod for development,
  Tome for a databaseless build, and Lagoon files to deploy it. Modules,
  a theme, site settings, pathauto and the Articles content followed within
  the week. This is the site that served druxtjs.org until the relaunch.
- **March 2022** — a month of care: the code of conduct, the project
  management files and the MIT license (#5), Gitpod and DDEV script fixes
  (#14, merged as #15), an update to Lagoon's foundry (#8, merged as #9),
  and the first of the Renovate dependency updates (#10, #11, #19).
- **April and May 2022** — Renovate kept the dependencies current (#20),
  with a DDEV MTU fix alongside, until the last update on 30 May 2022 (#23).
- **September 2026** — after four years standing still, the relaunch removed
  the Drupal 9 site and built what now runs: the Drupal 11 documentation
  backend, the Nuxt frontend, the playground, and the tooling described
  above.
