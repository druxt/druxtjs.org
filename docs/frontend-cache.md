# The frontend's cache, and clearing it

Druxt holds the JSON:API index and the menus between server renders, so a
warm render of a documentation page asks Drupal for one thing, the path
lookup, instead of six. Drupal decides how long: the page `max_age` in
`system.performance` becomes the `Cache-Control` on every anonymous JSON:API
answer, and Druxt keeps each answer for exactly that long. At 0 Drupal says
`no-cache, private` and nothing is kept.

The `druxt_frontend_cache` module tells the Nuxt server to empty that cache
when something changes here, so a publish shows on the next render instead
of after the `max_age`.

## What clears it

- Any cache tag invalidation. Every content, menu and configuration save
  invalidates tags.
- A full cache flush: `drush cache:rebuild` and the "Clear all caches" button
  empty the bins without invalidating tags, so `hook_cache_flush` is handled
  too.

One clear is sent per request, after the response has gone out, so an editor
never waits on it. Drush has no such moment, so there it is sent when the
process ends.

## Configuration

Two values, both in `settings.php` (`settings.lagoon.php` sets them from the
environment):

```php
$settings['druxt_frontend_cache'] = [
  // Where the Nuxt server is. Several, separated by commas, when there are
  // several processes: each keeps its own cache, so each has to be told.
  'url' => 'http://nuxt:3000',
  // The value the Nuxt server holds as druxt.cache.secret.
  'secret' => getenv('DRUXT_CACHE_SECRET'),
];
```

On Lagoon, set `DRUXT_CACHE_SECRET` as a project variable so both the `cli`
and `nuxt` services see the same value. The status report at
`/admin/reports/status` says whether the module can reach a frontend, and
warns until it can.

## Reading the log

The module logs to the `druxt_frontend_cache` channel, and only when a clear
fails:

| Frontend answered | Meaning                                               |
| ----------------- | ----------------------------------------------------- |
| 401               | Drupal's secret is not the one the Nuxt server holds. |
| 404               | `druxt.cache.secret` is not set in `nuxt.config.js`.  |
| unreachable       | The URL is wrong, or the Nuxt process is not up.      |

A clear that fails leaves the old content served until the `max_age` runs
out, which is what happened before this module existed. Nothing breaks; it is
just slow to update.

## A cache between Drupal and Nuxt

A cache between Drupal and the Nuxt server (a CDN, a Varnish) keeps its own
copy for the same `max_age`, and this module does not purge it. Drupal marks
authenticated answers `no-cache, private`, so such a cache never holds an
editor's data, but it will hold the old menu until the lifetime passes.
