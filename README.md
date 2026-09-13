<!-- vale off -->
<!-- The alt text describes what the banner shows: the druxtjs.org mark, name and description. The name-colon-description form trips ColonUsage. -->
<a href="https://druxtjs.org">
  <img src=".github/banner.svg" alt="druxtjs.org: Nuxt frontend and Drupal backend, built with Druxt">
</a>
<!-- vale on -->

# druxtjs.org

Nuxt frontend and Drupal backend, built with Druxt.

This repository is the source of [druxtjs.org](https://druxtjs.org), the
documentation site for [Druxt](https://github.com/druxt/druxt.js). It is also a
working example of a Druxt site: its pages are Drupal content, rendered by Nuxt.

The site is two applications in one repository. `nuxt/` is the frontend. It
renders the documentation with Druxt, through DruxtEntity and its wrapper
components. `drupal/` is the Drupal 11 backend that editors write in.

## Get involved

Run the whole site on your machine, frontend and backend together. Pick one of
three ways.

| Way                             | You need                                                  |
| ------------------------------- | --------------------------------------------------------- |
| [Dev container](#dev-container) | VS Code with Dev Containers, GitHub Codespaces, or DevPod |
| [mise](#mise)                   | [mise](https://mise.jdx.dev), and three PHP extensions    |
| [By hand](#by-hand)             | PHP 8.3 or later, Composer and Node 16.20.1               |

### Dev container

[![Open in DevPod!](https://devpod.sh/assets/open-in-devpod.svg)](https://devpod.sh/open#https://github.com/druxt/cms.druxtjs.org)

| Tool                        | How                                                                          |
| --------------------------- | ---------------------------------------------------------------------------- |
| VS Code                     | Clone the repository, open it, then choose **Reopen in Container**           |
| GitHub Codespaces           | On the repository page, open **Code** and choose **Codespaces**              |
| [DevPod](https://devpod.sh) | Click the badge, or run `devpod up https://github.com/druxt/cms.druxtjs.org` |

The container has Node 16.20.1, PHP 8.4, Composer and mise. Creating it runs
`npm install` and `npm run setup`, so Drupal is running when it opens. Then run
`npm run dev`.

### mise

`.mise.toml` pins Node 16.20.1 and PHP 8.4. PHP needs the `gd`, `pdo_sqlite`
and `sodium` extensions.

```sh
mise install
npm install
npm run setup
npm run dev
```

### By hand

Install PHP 8.3 or later with the `gd`, `pdo_sqlite` and `sodium` extensions,
Composer, and Node 16.20.1. Then run:

```sh
npm install
npm run setup
npm run dev
```

### What you get

| Command         | What it does                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `npm install`   | Installs the root tooling and enables the git hooks                                                               |
| `npm run setup` | Installs Drupal on a throwaway SQLite database and imports the documentation from druxt.js. Then it starts Drupal |
| `npm run dev`   | Starts the Nuxt dev server against that Drupal. The first run installs the frontend's packages                    |
| `npm run login` | Prints a one-time login link for Drupal                                                                           |

| Service | Address                                                                    |
| ------- | -------------------------------------------------------------------------- |
| Drupal  | <http://127.0.0.1:8888>, or the next free port. `npm run info` shows which |
| Nuxt    | <http://localhost:3000>                                                    |

`npm run setup` writes Drupal's address to `.env`, and `npm run dev` reads it
from there. Setup needs network access, for Composer packages and the pinned
documentation on GitHub.

## Write documentation

1. Run `npm run login`, and open the link it prints.
2. In Drupal, go to **Content** and edit a page, or add one. The layout
   paragraphs editor builds a page from sections of text, code and images.
3. Save, then reload the page on <http://localhost:3000>.

**Preview**, on the edit form, shows unsaved changes.
[docs/backend.md](docs/backend.md#previewing-a-page) explains its tabs.

The Modules, API reference and Components pages come from the druxt.js
packages. `npm run docs:generate` builds them locally, in the pinned druxt.js
checkout. It installs and builds druxt.js first, so the first run is slow.

### Where changes go

| Change                                               | Where it goes                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| The content model, the editor or the site's settings | Export them with `vendor/bin/drush config:export` in `drupal/`, and commit `drupal/config/sync/` in a pull request |
| The frontend                                         | A pull request with the change in `nuxt/`                                                                          |
| The text of a page                                   | A pull request to [druxt/druxt.js](https://github.com/druxt/druxt.js), where the documentation is still written    |

The site's content is stored in its database, and `npm run setup` seeds that
database from a pinned commit of druxt.js. Edits in your local Drupal stay
local.

## Druxt in the frontend

`nuxt/` is a Nuxt 2 app built with Druxt, and it is written to be read as an example of a Druxt site.

| What                       | How                                                                                                                                                                                                                                                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages                      | Each section page resolves its path with the Druxt router, then renders the Drupal page with `<DruxtEntity mode="full">`.                                                                                                                                                                                                          |
| Wrappers                   | `nuxt/components/druxt/` holds the wrapper components Druxt finds by name. The page is `entity/node/DocPageFull.vue`, with one component per paragraph type in `entity/paragraph/`. The rest are fields (`field/`), layout sections (`layout-paragraph/`), blocks (`block/`), block regions (`block-region/`) and menus (`menu/`). |
| Display settings           | druxt-schema reads Drupal's view and form displays when the app builds, so the frontend follows the display settings editors change in Drupal.                                                                                                                                                                                     |
| Layout                     | druxt-layout-paragraphs renders the page's layout sections.                                                                                                                                                                                                                                                                        |
| Header, sidebar and footer | druxt-blocks renders the blocks placed in the `druxtjs` theme's regions in Drupal. The theme and the site's name and logo come from the `druxtjs_org` consumer's decoupled settings, read at build by `nuxt/modules/decoupled-settings`.                                                                                           |
| UI                         | `nuxt/components/dui/` holds presentational components with no Drupal dependency: code blocks, diagrams, rich text and columns. They will move to the shared Druxt UI library.                                                                                                                                                     |

To change how something looks, find the wrapper name Druxt looked for (the Vue devtools show it), and add a component at the matching path under `nuxt/components/druxt/`. [Component resolution](https://druxtjs.org/explanation/component-resolution) explains the naming.

## Deployment

The site runs on Lagoon as one environment, Drupal beside Nuxt. Nuxt serves
pre-rendered pages first, and renders live any page it has not stored or
that has aged past its time to live. [docs/hosting.md](docs/hosting.md)
covers what a deployment does.

## Commands

| Command                  | What it does                                          |
| ------------------------ | ----------------------------------------------------- |
| `npm run setup`          | Install and import the backend, then start it         |
| `npm run dev`            | Nuxt dev server against the backend                   |
| `npm run start` / `stop` | Start or stop Drupal                                  |
| `npm run info`           | Where Drupal is, and the versions it runs             |
| `npm run login`          | One-time login link for Drupal                        |
| `npm run docs:generate`  | Build the Modules, API reference and Components pages |
| `npm run lint`           | Every linter except prose                             |
| `npm run lint:prose`     | Vale, after `npm run lint:prose:install` once         |
| `npm test`               | Node tests for the importer's scripts                 |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for commit messages, checks and what
never goes in a file. Open issues and pull requests on
[druxt/cms.druxtjs.org](https://github.com/druxt/cms.druxtjs.org).
[docs/backend.md](docs/backend.md) covers the importer and page history.

## License

[MIT](LICENSE)
