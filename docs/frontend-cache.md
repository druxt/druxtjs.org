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

## Drupal's side: one query for a response's cached normalizations

JSON:API keeps each resource object's normalization in the
`jsonapi_normalizations` cache and, in Drupal 11.4, reads them back one query
per object. A documentation page with its paragraphs, media and files
included is 18 to 46 objects; the collection behind `sitemap.xml` and
`llms.txt` is nearly 800. Drupal core issue
[3626255](https://www.drupal.org/project/drupal/issues/3626255) reads them
in one query per response level instead. Measured on this site with page
caches bypassed, the collection goes from 1301 queries to 77 and the largest
page from 107 to 63. The responses are byte-identical. Over a network
database the collection answered in 97 ms instead of 154.

The site applies it as two patches in `drupal/patches/`:

| Patch                                                                | What it is                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `drupal-core-3626255-prefetch-normalizations-mr17265-a9227f7b.patch` | The merge request's diff, verbatim, at the commit in the name. Vendored rather than fetched from the merge request URL because the branch moves and a core change is reviewed here before it changes.                                                                           |
| `jsonapi-3626255-data-normalizer-argument.patch`                     | One line in `jsonapi.services.yml`. The merge request targets Drupal's `main` branch, where the JSON:API services get their arguments by type. On 11.x they do not, so without this line every JSON:API request fails with a circular service reference. Reported on the issue. |

To take a newer revision of the merge request: download its `.diff`, save it
under a name with the new commit, point `drupal/composer.json` at it, run
`composer patches-relock` and `composer patches-repatch`, and confirm
`ResourceObjectNormalizationCacher.php` has `prefetch()` before committing.
`composer install` alone applies nothing to a package it already has. Drop
the argument patch when the merge request includes the argument or is merged
into 11.x, and both when the site's core includes the fix.

## A cache between Drupal and Nuxt

A CDN or a Varnish between the two keeps its own copy for the same
`max_age`, and this purger does not reach it. A second purger would. Drupal
marks authenticated answers `no-cache, private`, so such a cache never holds
an editor's data, but it will hold the old menu until the lifetime passes.

`drush p:queue-browse` is an interactive pager: do not call it from a script.
