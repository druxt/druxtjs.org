<?php

/**
 * @file
 * Refuses web requests while lagoon/post-rollout.sh replaces the database.
 *
 * A request that bootstraps Drupal against a half-imported database writes
 * caches into it, and the import then collides with those rows. The rollout
 * puts the marker on the files volume, which every pod mounts, and removes it
 * when it exits. A marker older than an hour belongs to a rollout that was
 * killed, and is ignored rather than left to hold the site down.
 */

$druxt_docs_replacing = __DIR__ . '/files/private/.replacing-database';
if (PHP_SAPI !== 'cli' && is_file($druxt_docs_replacing) && time() - filemtime($druxt_docs_replacing) < 3600) {
  http_response_code(503);
  header('Retry-After: 30');
  header('Cache-Control: no-store');
  print 'The database is being replaced. Try again shortly.';
  exit;
}
unset($druxt_docs_replacing);
