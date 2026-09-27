#!/bin/sh
# Production's scheduled database dump, for the other environments to start
# from.
#
# Without this every non-production rollout would run its own `mysqldump`
# against production, which is a read the live site does not need to serve.
# One scheduled dump serves every rollout until the next one replaces it.
#
# It is not a backup and does not excuse the absence of one: it is a single
# file, overwritten on each run, on the same volume as the site it came from.
#
# The file goes under the private files directory, which nginx does not
# serve. It is an unsanitised copy of production, so where it sits matters:
# the sanitising happens in the environment that receives it, not here.
set -eu

app=$(cd "$(dirname "$0")/.." && pwd)
export PATH="$app/drupal/vendor/bin:$PATH"
cd "$app/drupal"

# Only production has anything worth dumping for others, and only production
# should be spending its own time on it.
if [ "${LAGOON_ENVIRONMENT_TYPE:-}" != "production" ]; then
  echo "Not production; there is nothing here for other environments to copy."
  exit 0
fi

target="$app/drupal/web/sites/default/files/private/environment-dump"
mkdir -p "$target"
chmod 700 "$target"

# Written beside the destination and moved into place, so a rollout that
# reads it while this runs gets the previous dump whole rather than this
# one half-written.
#
# `--gzip` appends `.gz` to whatever `--result-file` names, so the name given
# to drush must not already end in it, and the file to check for is the one
# drush actually wrote.
uncompressed="$target/.latest.$$.sql"
staging="${uncompressed}.gz"
final="$target/latest.sql.gz"

echo "Dumping production for the other environments."
# Without the rows a request writes, or that visitors leave behind: the
# receiving environment has no use for them, and they are not its to hold.
drush sql:dump --gzip --extra-dump=--no-tablespaces --result-file="$uncompressed" \
  --structure-tables-list="cache,cache_*,cachetags,semaphore,sessions,watchdog,flood,key_value_expire,oauth2_token,oauth2_token__scopes,admin_audit_trail"

if [ ! -s "$staging" ]; then
  echo "The dump produced nothing; leaving any previous dump in place."
  rm -f "$staging" "$uncompressed"
  exit 1
fi

mv "$staging" "$final"
chmod 600 "$final"
echo "Wrote $(wc -c < "$final") bytes to ${final}."
