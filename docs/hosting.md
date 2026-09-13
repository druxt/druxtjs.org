# Hosting on Lagoon

How druxtjs.org runs on [Lagoon](https://docs.lagoon.sh). The
[README](../README.md) covers running it on your own machine.

## Status

Ready for a first deployment to a development environment. The live site
still runs from the druxt.js repository until the cutover.

## Services

One environment runs the whole site. `docker-compose.yml` names the
services, and `.lagoon.yml` adds the post-rollout task.

| Service   | Built from                             | What it does                                        |
| --------- | -------------------------------------- | --------------------------------------------------- |
| `nuxt`    | `lagoon/nuxt.dockerfile`, Node 16      | Serves the site, and proxies Drupal's API and files |
| `nginx`   | `lagoon/nginx.dockerfile`              | Serves Drupal, including its admin pages            |
| `php`     | `lagoon/php.dockerfile`, PHP 8.3       | Runs Drupal for `nginx`, in the same pod            |
| `cli`     | `lagoon/cli.dockerfile`                | Runs the post-rollout task, and `drush` over SSH    |
| `mariadb` | `uselagoon/mariadb-10.11-drupal` image | Drupal's database, with no route                    |

`nuxt` and `nginx` each get a route, named after the service:
`https://nuxt.<environment>.<project>.<cluster domain>` for the site, and
the same with `nginx` for Drupal.

## Deployment steps

1. Lagoon builds the images. The `nuxt` image clones the druxt.js commit
   pinned in `docs-source.json` and runs docgen, which writes the generated
   pages that `npm run docs:generate` writes locally.
2. The containers start. Until the app is ready, `nuxt` answers every
   request with the starting page, which names the step it is on.
3. The post-rollout task, `lagoon/post-rollout.sh`, runs in `cli`. On a new
   environment it installs Drupal from `drupal/config/sync` and imports the
   documentation from the pinned commit. On an existing one it runs
   `drush deploy`. It also creates Simple OAuth's keys, once, on the files
   volume.
4. Once Drupal's footer menu has items, `nuxt` builds the app against it and
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
| A page with a query string                        | Rendered live, and never stored                        |
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

A stored page is also kept as brotli and gzip copies, and the server sends the
one the browser accepts, with `Vary: Accept-Encoding`.

Every response sends `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy`
that turns off the camera, microphone and location, plus HSTS when the request
came over HTTPS. There is no `X-Frame-Options`, because Drupal's preview frames
the site. Every environment except production also sends
`X-Robots-Tag: noindex, nofollow`.

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

## Not done yet

- The app builds each time the `nuxt` container starts, which takes a few
  minutes behind the starting page. A deployment shows it for that long, and
  so does a development environment waking from idle.
- The redirects for the package subdomains are still served from the
  druxt.js repository.
- `docker-compose.yml` is written for Lagoon, and has not been run with
  `docker compose` yet.
