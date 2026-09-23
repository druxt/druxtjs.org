<?php

/**
 * @file
 * Refuses web requests while lagoon/post-rollout.sh replaces the database.
 *
 * A request that bootstraps Drupal against a half-imported database writes
 * caches into it, and the import then collides with those rows. The rollout
 * puts the marker on the files volume, which every pod mounts, and removes it
 * when it exits.
 *
 * The rollout also touches the marker every few seconds for as long as it
 * runs, so the marker's age says whether a rollout is still going rather than
 * how long it has been going. A marker nobody has touched for a minute
 * belongs to a rollout that was killed, and is ignored rather than left to
 * hold the site down. An hour was the earlier rule, and it let requests
 * through while a slow copy was still running.
 *
 * The stat cache is cleared first: without it a long-lived process answers
 * from the age it read on an earlier request, and the guard either opens
 * early or stays shut after the rollout has gone.
 */

const DRUXT_DOCS_REPLACING_STALE = 60;

$druxt_docs_replacing = __DIR__ . '/files/private/.replacing-database';
clearstatcache(TRUE, $druxt_docs_replacing);
if (PHP_SAPI !== 'cli' && is_file($druxt_docs_replacing) && time() - filemtime($druxt_docs_replacing) < DRUXT_DOCS_REPLACING_STALE) {
  http_response_code(503);
  header('Retry-After: 30');
  header('Cache-Control: no-store');
  print 'The database is being replaced. Try again shortly.';
  exit;
}
unset($druxt_docs_replacing);
