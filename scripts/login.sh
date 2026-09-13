#!/usr/bin/env sh
# Prints a one-time login link for the local Drupal, on the URL in .env.
set -eu
cd "$(dirname "$0")/.."

uri=""
if [ -f .env ]; then
  uri="$(sed -n 's/^BASE_URL=//p' .env | head -n 1)"
fi
cd drupal
exec vendor/bin/drush -r "$PWD/web" user:login ${uri:+--uri="$uri"} "$@"
