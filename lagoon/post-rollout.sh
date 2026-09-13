#!/bin/sh
# After each rollout: install or update Drupal, seed a new site's
# documentation, and give Simple OAuth its keys.
set -eu

app=$(cd "$(dirname "$0")/.." && pwd)
export PATH="$app/drupal/vendor/bin:$PATH"
cd "$app/drupal"

if drush status --field=bootstrap 2>/dev/null | grep -q Successful; then
  echo "Updating the installed site."
  drush deploy --yes
else
  echo "Installing the site from its committed configuration."
  # A password drush did not generate is one it does not print into the deploy log.
  drush site:install --existing-config --yes --account-pass="$(head -c 32 /dev/urandom | base64)"
  # Without this, the first import on Lagoon found no migrations and the web found no field types.
  drush cache:rebuild
fi

pages=$(drush php:eval 'echo \Drupal::entityQuery("node")->accessCheck(FALSE)->condition("type", "doc_page")->count()->execute();')
if [ "$pages" = "0" ]; then
  echo "No documentation yet. Importing it from the pinned source."
  php .devtools/import
fi

keys="$app/drupal/web/sites/default/files/private/oauth"
if [ ! -f "$keys/private.key" ]; then
  echo "Generating the Simple OAuth keys."
  mkdir -p "$keys"
  drush php:eval "\\Drupal::service('simple_oauth.key.generator')->generateKeys('$keys');"
  chmod 600 "$keys/private.key" "$keys/public.key"
fi

drush cache:rebuild
