# The frontend's cache, and clearing it

Druxt holds the JSON:API index and the menus between server renders, so a
warm render of a documentation page asks Drupal for one thing, the path
lookup, instead of six. Drupal decides how long: the page `max_age` in
`system.performance` becomes the `Cache-Control` on every anonymous JSON:API
answer, and Druxt keeps each answer for exactly that long. At 0 Drupal says
`no-cache, private` and nothing is kept.

Purge tells the Nuxt server to empty that cache when something changes here,
so a publish shows on the next render instead of after the `max_age`.

## How it is wired

| Piece     | Module                             | Role                                                                            |
| --------- | ---------------------------------- | ------------------------------------------------------------------------------- |
| queuer    | `purge_queuer_coretags`            | queues every cache tag Drupal invalidates: a save of one menu link queues seven |
| purger    | `purge_purger_http`, `httpbundled` | sends one `POST /_druxt/cache/clear` per batch, the secret in `X-Druxt-Secret`  |
| processor | `purge_processor_lateruntime`      | works the queue after the response, so an editor never waits on it              |

The Nuxt server clears its whole cache on that POST and ignores the body, so
the tags never leave Drupal. Clearing by tag is druxt.js 0.26.0 work; when it
lands, the same purger gains a body.

## Configuration

The purger is configuration (`purge_purger_http.settings.705a5122da`) and is
exported with an empty secret and Lagoon's service address. Each environment
completes it in `settings.php`; `settings.lagoon.php` does this from the
environment:

```php
$purger = 'purge_purger_http.settings.705a5122da';
$config[$purger]['hostname'] = 'nuxt';
$config[$purger]['port'] = 3000;
$config[$purger]['headers'][0]['value'] = getenv('DRUXT_CACHE_SECRET');
```

The Nuxt server reads that secret as `druxt.cache.secret`. On Lagoon
`DRUXT_CACHE_SECRET` is one project variable, so both services read it. Each
Nuxt process keeps its own cache; a site with several needs a purger per
process.

## Reading what happened

`drush p:diagnostics` says whether a purger is loaded and the queue is
draining. `drush p:queue-stats` counts successes and failures. A refused POST
is logged by Purge as a failed item and stays queued; the next batch that
succeeds sends it too.

| Nuxt answered | Meaning                                                      |
| ------------- | ------------------------------------------------------------ |
| 204           | cleared                                                      |
| 401           | Drupal's secret is not the one the Nuxt server holds         |
| 404           | `druxt.cache.secret` is not set in `nuxt.config.js`          |
| unreachable   | the hostname or port is wrong, or the Nuxt process is not up |

A clear that fails leaves the old content served until the `max_age` runs
out. Nothing breaks, it is slow to update.

## A cache between Drupal and Nuxt

A CDN or a Varnish between the two keeps its own copy for the same
`max_age`, and this purger does not reach it. A second purger would. Drupal
marks authenticated answers `no-cache, private`, so such a cache never holds
an editor's data, but it will hold the old menu until the lifetime passes.

`drush p:queue-browse` is an interactive pager: do not call it from a script.
