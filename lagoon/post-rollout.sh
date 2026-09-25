#!/bin/sh
# After each rollout: bring this environment's database to the branch it is
# deploying, and record what it deployed.
#
# The documentation lives in production's database. A non-production
# environment therefore starts from a sanitised copy of it, and the branch's
# updates and configuration are applied on top, so it holds real content on
# new code before anything reads it.
#
# On Lagoon there is always a database to be had, because production's can
# be copied, so seeding from the pinned corpus is the last resort and not
# the routine. It happens only when the sync was turned off and nothing is
# installed. A local checkout is the other way round: a contributor has no
# production to copy, so `npm run setup` seeds from the pin, and this script
# is not part of that path.
#
# DOCS_SKIP_SYNC=1 turns the sync off for an environment that wants to keep
# the database it has.
#
# Production syncs from nothing and seeds from nothing. It is the source.
set -eu

app=$(cd "$(dirname "$0")/.." && pwd)
export PATH="$app/drupal/vendor/bin:$PATH"
cd "$app/drupal"

environment_type="${LAGOON_ENVIRONMENT_TYPE:-}"
environment_name="${LAGOON_ENVIRONMENT:-}"
production_alias="@lagoon.druxtjs-org-main"

# Copied without their rows: what a request writes, and what production's
# visitors leave behind. Drupal rebuilds the caches, and the rest is no one
# else's to hold.
volatile_tables="cache,cache_*,cachetags,semaphore,sessions,watchdog,flood,key_value_expire,oauth2_token,oauth2_token__scopes,admin_audit_trail"

# While this exists Drupal answers every web request with a 503
# (settings.replacing.php). A request that bootstraps Drupal against a
# half-imported database writes into it, and the import then collides with
# its own rows.
replacing="$app/drupal/web/sites/default/files/private/.replacing-database"

# How often the marker says the rollout is still going, and the pid of the
# process saying it. The guard ignores a marker that has stopped being
# touched, so this has to be well inside the guard's window, which is a
# minute. Shortened by the guardrail tests, which cannot wait that long.
heartbeat_interval="${DOCS_REPLACING_HEARTBEAT:-15}"
heartbeat=""

# Two independent tests, because what follows begins by dropping a database.
# An environment that cannot say what it is does not get synced: the answer
# to "is this production?" must be a clear no, not an absent yes.
is_production() {
  [ "$environment_type" = "production" ] || [ "$environment_name" = "main" ]
}

may_sync() {
  if [ "${DOCS_SKIP_SYNC:-}" = "1" ]; then
    echo "DOCS_SKIP_SYNC is set; keeping the database this environment already has."
    return 1
  fi
  if [ -z "$environment_type" ] && [ -z "$environment_name" ]; then
    echo "This environment does not say what it is, so it will not be synced."
    return 1
  fi
  if is_production; then
    return 1
  fi
  return 0
}

# Production writes a dump on a schedule for exactly this. Copying that file
# costs production a read of a file; running `sql:sync` costs it a full
# mysqldump of the live database, per rollout, per environment. So the file
# is tried first and the live sync is the fallback.
load_from_production() {
  mkdir -p "$(dirname "$replacing")"
  : > "$replacing"
  # The guard reads the marker's age, so the marker says "still going" every
  # few seconds for as long as this runs. A copy that takes longer than the
  # guard's patience would otherwise let requests in against a database that
  # is still half-replaced, which is the thing the marker exists to prevent.
  while : ; do
    sleep "$heartbeat_interval"
    touch "$replacing" 2>/dev/null || exit 0
  done &
  heartbeat=$!
  # Waited for, not just signalled: a touch that lands after the marker is
  # removed would put it back, and the site would refuse requests until
  # something noticed.
  # Each step is allowed to fail: `set -e` would otherwise abandon the trap
  # on the status a killed child returns, and leave the marker behind with
  # the site refusing every request.
  trap 'kill "$heartbeat" 2>/dev/null || :; wait "$heartbeat" 2>/dev/null || :; rm -f "$replacing"' EXIT

  dump="/tmp/production.sql.gz"
  rm -f "$dump" "${dump%.gz}"

  if drush rsync -y "${production_alias}:%files/private/environment-dump/latest.sql.gz" "$dump" 2>/dev/null && [ -s "$dump" ]; then
    echo "  using production's scheduled dump."
    gunzip -f "$dump"
    drush sql:drop --yes
    drush sql:query --file="${dump%.gz}"
    rm -f "${dump%.gz}"
    return 0
  fi

  echo "  no scheduled dump to copy; reading the live database instead."
  drush sql:sync "$production_alias" @self --yes --structure-tables-list="$volatile_tables"
}

# The addresses that survive the sanitise: this site's own maintainers, so
# someone editing a non-production environment is the person they are in
# production. Every other address is scrubbed.
maintainer_domain="${DOCS_MAINTAINER_DOMAIN:-druxtjs.org}"
kept_addresses="/tmp/kept-addresses.tsv"

# The domain goes into the query that decides which addresses survive, so
# only a hostname is accepted. A value carrying a quote would rewrite that
# query, and `%@' OR 1=1 -- ` would hand production's whole address book
# back to a non-production environment and print it into the rollout log.
is_hostname() {
  case "$1" in
    '' | *[!a-zA-Z0-9.-]* | .* | *. | -* | *- | *..*) return 1 ;;
    *.*) return 0 ;;
    *) return 1 ;;
  esac
}

# Written back over the sanitised addresses. An address is Drupal's handle
# on a person: it names them in the interface, it is who a mail would go to,
# and a maintainer testing their own site is not user+2@localhost.
restore_addresses() {
  [ -s "$kept_addresses" ] || return 0
  while IFS="$(printf '\t')" read -r uid mail; do
    # The header row a client may print, and anything that is not a plain
    # address, are skipped rather than built into SQL.
    case "$uid" in '' | *[!0-9]*) continue ;; esac
    case "$mail" in '' | *"'"* | *'\'*) continue ;; esac
    drush sql:query "UPDATE users_field_data SET mail = '${mail}', init = '${mail}' WHERE uid = ${uid};"
    echo "  kept ${mail}."
  done < "$kept_addresses"
}

# A password the sanitise would otherwise take with it. Every rollout
# replaces this environment's database, so without this a maintainer is
# locked out of their own environment until someone sets a password by hand.
# It comes from a Lagoon variable rather than being generated, so it is the
# same password after every rollout, and it is never printed.
#
# Drupal reads both the name and the password out of the environment rather
# than taking them as arguments: an argument is in the process list for
# anything else in the container to read, and the variables are there
# already. The password and the unblock are one call, so an account cannot
# be reported as usable while it is still blocked.
#
# It says what it did on its own output rather than in an exit status:
# drush reports a PHP `exit()` as its own failure, so a missing account and
# a broken bootstrap would look the same.
restore_maintainer_login() {
  [ -n "${DOCS_MAINTAINER_NAME:-}" ] || return 0
  if [ -z "${DOCS_MAINTAINER_PASSWORD:-}" ]; then
    echo "  DOCS_MAINTAINER_NAME is set without DOCS_MAINTAINER_PASSWORD; the account stays sanitised."
    return 0
  fi
  restored=$(drush php:eval '
    $accounts = \Drupal::entityTypeManager()->getStorage("user")
      ->loadByProperties(["name" => getenv("DOCS_MAINTAINER_NAME")]);
    $account = reset($accounts);
    if (!$account) { print "no-account"; return; }
    $account->setPassword(getenv("DOCS_MAINTAINER_PASSWORD"));
    $account->activate();
    $account->save();
    print "login-restored";
  ' 2>/dev/null || :)
  case "$restored" in
    *login-restored*) echo "  ${DOCS_MAINTAINER_NAME} can sign in again." ;;
    *no-account*) echo "  no ${DOCS_MAINTAINER_NAME} account in this copy; nothing to restore." ;;
    *) echo "  could not restore ${DOCS_MAINTAINER_NAME}'s login; the account stays sanitised." ;;
  esac
}

# Remove what a contributor should never be handed. `sql:sanitize` covers
# the accounts; the rest is what this site carries beyond them. The consumer
# rows stay, because the frontend authenticates against one, but their
# secrets do not survive the copy.
sanitise() {
  echo "Sanitising the copy."

  # Read before sanitising: `sql:sanitize` overwrites every address, and
  # what it replaced is not recoverable afterwards.
  rm -f "$kept_addresses"
  if is_hostname "$maintainer_domain"; then
    drush sql:query "SELECT uid, mail FROM users_field_data WHERE mail LIKE '%@${maintainer_domain}';" > "$kept_addresses" 2>/dev/null || :
  else
    echo "  DOCS_MAINTAINER_DOMAIN is not a hostname, so no address is kept."
  fi

  drush sql:sanitize --yes

  for table in sessions oauth2_token oauth2_token__scopes watchdog flood key_value_expire admin_audit_trail; do
    drush sql:query "TRUNCATE TABLE ${table};" || echo "  no ${table} table to clear."
  done

  drush sql:query "UPDATE consumer_field_data SET secret = CONCAT('sanitised-', client_id);"

  # Prove it rather than assume it: a sanitiser that silently did nothing
  # would leave production credentials in an environment meant to be safe.
  remaining=$(drush sql:query "SELECT COUNT(*) FROM sessions;" | tr -cd '0-9')
  if [ "${remaining:-1}" != "0" ]; then
    echo "Sanitisation did not clear the sessions table; refusing to leave this environment usable."
    exit 1
  fi
  # After the check, never before it: a sanitise that did not happen must
  # not be handed an address or a password to put back.
  restore_addresses
  restore_maintainer_login
  echo "Sanitised."
}

if may_sync; then
  echo "Replacing this environment's database with a copy of production."
  echo "  target: ${environment_name:-unnamed} (${environment_type:-untyped})"
  echo "  source: ${production_alias}"
  load_from_production
  sanitise
fi

if drush status --field=bootstrap 2>/dev/null | grep -q Successful; then
  echo "Updating the site."
  drush deploy --yes
  seed_needed=0
else
  echo "No database to update. Installing the site from its committed configuration."
  # A password drush did not generate is one it does not print into the deploy log.
  drush site:install --existing-config --yes --account-pass="$(head -c 32 /dev/urandom | base64)"
  # Without this, the first import on Lagoon found no migrations and the web found no field types.
  drush cache:rebuild
  # Nothing was synced and nothing was installed before this, so the pinned
  # corpus is the only content there is.
  seed_needed=1
fi

if [ "$seed_needed" = "1" ]; then
  echo "Nothing was copied and nothing was installed before this, so the pinned source is the only content there is."
  php .devtools/import
fi

# The frontend's consumer comes from production's database, where neither
# this environment's callback nor the sign-in settings may be.
echo "Allowing this environment's frontend to sign editors in."
drush druxtjsorg:oauth-client

keys="$app/drupal/web/sites/default/files/private/oauth"
if [ ! -s "$keys/private.key" ] || [ ! -s "$keys/public.key" ]; then
  echo "Generating the Simple OAuth keys."
  mkdir -p "$keys"
  rm -f "$keys/private.key" "$keys/public.key"
  drush php:eval "\\Drupal::service('simple_oauth.key.generator')->generateKeys('$keys');"
  chmod 600 "$keys/private.key" "$keys/public.key"
fi

drush cache:rebuild

# Record the revision this rollout applied, now that its updates and its
# configuration import have succeeded. The frontend waits for this to match
# the revision it was built from before it builds, so it is written last:
# writing it earlier would tell the frontend the site was ready while the
# steps above were still running, which is the failure it prevents.
#
# `set -e` means an earlier failure never reaches this line, so an
# interrupted rollout leaves the previous revision in place rather than
# claiming this one.
if [ -n "${LAGOON_GIT_SHA:-}" ]; then
  echo "Recording the deployed revision ${LAGOON_GIT_SHA}."
  drush state:set druxt_docs.deployed_revision "$LAGOON_GIT_SHA" --input-format=string --yes
else
  echo "No LAGOON_GIT_SHA in this environment; leaving the deployed revision unset."
fi
