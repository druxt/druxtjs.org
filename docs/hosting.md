# Hosting on Lagoon

How druxtjs.org runs on [Lagoon](https://docs.lagoon.sh). The
[README](../README.md) covers running it on your own machine.

## Status

Lagoon builds `feature/lagoon` into a development environment and `main`
into production. The checklist at the end is what the first production
deployment needs.

## Services

One environment runs the whole site. `docker-compose.yml` names the
services, and `.lagoon.yml` adds the post-rollout task.

| Service     | Built from                             | What it does                                                                 |
| ----------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `nuxt`      | `lagoon/nuxt.dockerfile`, Node 16      | Serves the site, and proxies Drupal's API and files                          |
| `storybook` | `lagoon/storybook.dockerfile`, Node 16 | Storybook for the site's components and Druxt's, started once Drupal answers |
| `nginx`     | `lagoon/nginx.dockerfile`              | Serves Drupal, including its admin pages                                     |
| `php`       | `lagoon/php.dockerfile`, PHP 8.3       | Runs Drupal for `nginx`, in the same pod                                     |
| `cli`       | `lagoon/cli.dockerfile`                | Runs the post-rollout task, and `drush` over SSH                             |
| `mariadb`   | `uselagoon/mariadb-10.11-drupal` image | Drupal's database, with no route                                             |

Storybook writes its Druxt stories from Drupal when its container starts,
and the task that runs after the rollout imports the configuration later. So
a change to something those stories read, such as a menu's description,
shows on the rollout after the one that imports it.

`nuxt`, `nginx` and `storybook` each get a route, named after the service:
`https://nuxt.<environment>.<project>.<cluster domain>` for the site, and
the same with `nginx` for Drupal and `storybook` for Storybook. The site
reads its Storybook's route from `LAGOON_ROUTES` and links to it from the
footer and the playground. Production's hosts, `druxtjs.org`,
`storybook.druxtjs.org`, `cms.druxtjs.org` for Drupal and the package
subdomains, are set in `.lagoon.yml`.

## Deployment steps

1. Lagoon builds the images. The `nuxt` image runs docgen over druxt.js at
   the `docgenRef` in `docs-source.json`, and lays the generated pages over the
   authored markdown at `ref`, as `npm run docs:generate` does locally.
2. The containers start. Until the app is ready, `nuxt` answers every
   request with the starting page, which names the step it is on.
3. The post-rollout task, `lagoon/post-rollout.sh`, runs in `cli`. A
   non-production environment first replaces its database with a sanitised
   copy of production's, so the updates that follow run against real
   content. Drupal answers every web request with a 503 until the task is
   done, so nothing writes into the database while it is half-imported, and
   caches, sessions, logs and tokens are copied without their rows. It copies the dump production writes nightly
   (`lagoon/dump-for-environments.sh`, under the private files directory
   nginx does not serve) and falls back to reading production's live
   database only when that file is not there. `DOCS_SKIP_SYNC=1` keeps the
   database an environment already has. Production syncs from nothing. Either
   way it then runs `drush deploy`, or installs from `drupal/config/sync`
   when there is no database at all. It seeds from the pinned commit only
   in that last case. It also creates
   Simple OAuth's keys, once, on the files volume, and records the
   revision it deployed.
4. Once Drupal reports that revision, `nuxt` builds the app against it and
   starts serving. It then renders every page it can reach into its page
   cache.

The app builds when it starts, not in the image, because it reads Drupal
while it builds: druxt-schema reads the display settings, and the decoupled
settings module reads the site's settings and theme.

## The starting page

`nuxt/server/starting.html` holds the port until the app is ready. It is a
single self-contained document. The logo sits above the step in words, with a
bar of three segments under it.

| Phase      | What is happening                             |
| ---------- | --------------------------------------------- |
| `waiting`  | Drupal is still installing and importing      |
| `building` | The app is building against Drupal            |
| `starting` | The build is done and the server is coming up |
| `failed`   | The build failed, and the container restarts  |

The page asks `GET /__status` every 2.5 seconds, which answers
`{ phase, step, steps, since }`. Once the app takes the port that path is
gone, so the next poll gets a 404 and the page reloads into the real site.
Past five minutes it adds a line saying it is taking longer than usual,
worked out on the page from `since`, so the endpoint doesn't track it.

With JavaScript off the page reloads itself every 15 seconds, and shows the
phase the server knew when it was served.

## The page cache

`nuxt/server/start.js` is the production server. `yarn start` in `nuxt/`
runs it.

| Request                                           | Answer                                                 |
| ------------------------------------------------- | ------------------------------------------------------ |
| A stored page                                     | The stored HTML, with `X-Docs-Cache: HIT`              |
| A stored page older than `DOCS_CACHE_TTL`         | The stored HTML (`STALE`), while a fresh copy renders  |
| A page it has not stored                          | Rendered live (`MISS`), then stored if it answered 200 |
| A page with `?live=1`                             | Rendered live, and never stored                        |
| A page with any other query string                | The stored copy for the path                           |
| A page path with a trailing slash                 | A 301 to the same path without it                      |
| `/jsonapi`, `/router/translate-path` and `/sites` | Proxied to Drupal                                      |

A page edited in Drupal changes on the site once its stored copy is older
than the time to live: the next request gets the old copy and renders the
new one, and the request after that gets the new one. A deployment starts
with an empty cache.

| Variable           | Default             | What it does                                             |
| ------------------ | ------------------- | -------------------------------------------------------- |
| `DRUXT_BASE_URL`   | `http://nginx:8080` | Where the server reaches Drupal                          |
| `SITE_ORIGIN`      | The `nuxt` route    | The origin in canonical links and share cards            |
| `DOCS_CACHE_TTL`   | `300`               | Seconds before a stored page renders again               |
| `DOCS_CACHE`       | On                  | `0` renders every page live                              |
| `DOCS_CACHE_DIR`   | `nuxt/.cache/pages` | Where the stored pages go                                |
| `START_FAIL_GRACE` | `30`                | Seconds the failed page shows before the container exits |

The `nuxt` route the table's default names is picked from `LAGOON_ROUTES` at
startup: the route for `druxtjs.org` wins over `www.druxtjs.org`, which wins
over any other custom route named for the `nuxt` service, which wins over
Lagoon's autogenerated route for it. An explicit `SITE_ORIGIN`, or
`DRUXT_FRONTEND_URL`, overrides the routes entirely. Production never advertises the autogenerated
route: if the routes don't name a custom origin, the origin is `druxtjs.org`.

Production has no autogenerated routes to advertise in any case.
`.lagoon.yml` turns them off for `main` alone (`autogenerateRoutes: false`),
because every service there has a custom route: `druxtjs.org` for `nuxt`,
`cms.druxtjs.org` for `nginx` and `storybook.druxtjs.org` for `storybook`.
Every other environment keeps its autogenerated routes, which are all it
has. Drupal reads the same order when it decides where to send an anonymous
visitor, so the two halves agree on which host is the frontend.

A stored page is also kept as brotli and gzip copies, and the server sends the
one the browser accepts, with `Vary: Accept-Encoding`.

Every response sends `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy`
that turns off the camera, microphone and location, plus HSTS when the request
came over HTTPS. There is no `X-Frame-Options`, because Drupal's preview frames
the site. Every environment except production also sends
`X-Robots-Tag: noindex, nofollow`. The header is also sent on any
`*.amazee.io` host, which production no longer has, so that rule now only
covers an environment that acquires one.

## Drupal's settings on Lagoon

The `cli` image writes `settings.php` from core's default and includes
`drupal/web/sites/default/settings.lagoon.php`, which reads Lagoon's
environment variables. Nothing on your own machine reads that file.

| Setting            | Comes from                                                            |
| ------------------ | --------------------------------------------------------------------- |
| Database           | `MARIADB_HOST`, `MARIADB_DATABASE` and the other `MARIADB_` variables |
| Trusted hosts      | Every route in `LAGOON_ROUTES`, and `nginx`, the name `nuxt` uses     |
| Hash salt          | `DRUPAL_HASH_SALT`, or one made from the database password            |
| Frontend redirects | `DRUXT_FRONTEND_URL`, or the `nuxt` route                             |
| Simple OAuth keys  | `files/private/oauth`, which nginx never serves                       |

`drupal/config/sync` enables both database driver modules: `mysql` for
Lagoon, and `sqlite` for local sites and CI. Drupal refuses to uninstall the
module that provides the database it runs on, so a configuration without
the driver fails to install on that database.

## The development snapshot

`dev.druxtjs.org` runs the site on the latest Druxt development release, so a
change merged to druxt.js can be seen on a real site before it is released.

Its Storybook is `storybook.dev.druxtjs.org`, and its Drupal `cms.dev.druxtjs.org`.

| Part          | Where                                                              |
| ------------- | ------------------------------------------------------------------ |
| Branch        | `dev-snapshot`, rebuilt by `.github/workflows/dev-snapshot.yml`    |
| Packages      | Every Druxt package at the npm `dev` tag, one build, one copy each |
| API reference | Generated at the druxt.js commit the build came from (`docgenRef`) |
| Release notes | The pending changesets, headed with the version the site installs  |
| Version badge | `v0.25.0-dev`, with the build time in its title                    |

druxt.js publishes a snapshot on each merge to its develop branch. The
workflow looks for a new one every 20 minutes, or at once when druxt.js
sends a `druxt-dev-snapshot` repository dispatch. It finds the commit a
snapshot came from in druxt.js's Release runs, and refuses a snapshot that no
run accounts for. The branch is this repository's base plus one commit, and
is pushed only when the snapshot or the base has changed, so it is replaced
each time and never committed to by hand.

On that branch, `docs-source.json` has `snapshot`, the build time. With it
set, docgen fetches druxt.js without its file contents but with its history,
which changesets needs to link each entry to its commit, and runs
`scripts/snapshot-changelog.sh` before generating. `npm run docs:generate`
does the same locally.

To rebuild it by hand, run the workflow from the Actions tab. `base` picks the
branch to start from, and the `DEV_SNAPSHOT_BASE` repository variable changes
the default, which is `develop`.

## Going to production

What the cutover from the druxt.js build needs, in order.

1. Point the production route at this project's `nuxt` service, with
   `www.druxtjs.org` and the package subdomains (`blocks.druxtjs.org` and
   the others) as routes on the same service; the server answers each
   subdomain with a redirect to `druxtjs.org`, and `www.druxtjs.org`
   redirects each path to the same path on the apex.
2. Give `storybook.druxtjs.org` and `cms.druxtjs.org` DNS records. The
   other hosts are CNAME records to the platform's CDN, which answers TLS
   only for hostnames it knows, so a new hostname is registered with the
   platform first or its record points at the cluster's ingress instead.
3. Set `LAGOON_ENVIRONMENT_TYPE=production` on that environment: it turns on
   the GA4 tag and turns off the `noindex` header previews send.
4. Confirm the Drupal environment variables the settings file reads, and that
   the site mail address is one the domain's SPF record allows to send.
5. After the first deployment, check `sitemap.xml`, `robots.txt`,
   `llms.txt` and `llms-full.txt`, and that an old path such as
   `/guide/getting-started` and a legacy reference path such as
   `/api/components/DruxtEntity.html` redirect.
6. Watch the first deployment's rollout: every restart serves errors for
   about a minute, then the starting page, until the app has built.

## Rolling back

Every deployment builds from a git branch head, so a rollback is a git
operation followed by a deployment, smallest first.

- **A bad release of this site.** Revert the release commit on `main` and
  push, and Lagoon builds `main` again from the reverted tree. The services
  are unchanged, so the environment takes it without recreation.
- **Checking an older release first.** Push a branch at a tag like
  `release/0.9.0`, and the project's branch rule deploys it as its own
  environment beside production.
- **Back to the site before the relaunch.** Production used to build from
  `druxt/druxt.js`, not from this repository. The project's settings are put
  back exactly as they were, then production is rebuilt and the pre-cutover
  backups are restored onto it:

  ```sh
  lagoon update project -p druxtjs-org \
    --git-url git@github.com:druxt/druxt.js.git \
    --branches '^feature/|^(develop|main)$' \
    --pullrequests true
  lagoon delete environment -p druxtjs-org -e main
  lagoon deploy branch -p druxtjs-org -b main
  ```

  The deletion is required either way: the old site's `nginx` service and this
  one's differ in type, and a Deployment's selector is immutable. It is real
  downtime while `main` builds again, and if the routes or certificates do
  not come back, amazee.io support restores them. The full story of the
  switch, including the state to restore to, is the `lagoon git url` rollback
  note kept with the project's artifacts.

Before any of that: this agent cannot `lagoon ssh`, because the agent refuses
to sign, so a command on an environment runs as a custom task through the
API. The database dumps and files taken before the cutover were produced that
way, with the platform's own backups beside them.

## Not done yet

- The app builds each time the `nuxt` container starts, which takes a few
  minutes behind the starting page. A deployment shows it for that long, and
  so does a development environment waking from idle. A prebuilt image would
  close it.
- A 404 is never stored, so a crawl of missing URLs renders each one live.
- `docker-compose.yml` is written for Lagoon, and has not been run with
  `docker compose` yet.
