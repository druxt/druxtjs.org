#!/usr/bin/env bash
# Guards lagoon/post-rollout.sh, which begins by dropping a database.
#
# The rollout is run against a stub `drush` that records what it was asked
# to do instead of doing it, so every branch can be exercised here with no
# database, no network and no Lagoon.
#
# Every case is asserted in both directions. "Production was not synced" is
# only meaningful beside a case where a sync did happen, or the assertion
# would pass against a script that syncs nothing at all.

set -uo pipefail

cd "$(dirname "$0")/.."

readonly ROLLOUT="$PWD/lagoon/post-rollout.sh"

pass=0
fail=0

ok() {
  printf '[ OK ] %s\n' "$1"
  pass=$((pass + 1))
}

no() {
  printf '[FAIL] %s\n' "$1"
  fail=$((fail + 1))
}

scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

# A fake application tree: the rollout finds its root from its own path, and
# prepends drupal/vendor/bin to PATH, which is where the stub drush goes.
#
# bootstrap=yes|no decides whether `drush status` reports an installed site.
build_app() {
  local bootstrap="$1" sessions="${2:-0}"
  local app="$scratch/app-$RANDOM"
  mkdir -p "$app/lagoon" "$app/drupal/vendor/bin" "$app/drupal/.devtools"
  cp "$ROLLOUT" "$app/lagoon/post-rollout.sh"

  # Keys already in place: generating them is a real drush call this stub
  # cannot make, and the rollout would then stop on the chmod that follows.
  mkdir -p "$app/drupal/web/sites/default/files/private/oauth"
  printf 'key' > "$app/drupal/web/sites/default/files/private/oauth/private.key"
  printf 'key' > "$app/drupal/web/sites/default/files/private/oauth/public.key"

  cat > "$app/drupal/vendor/bin/drush" <<EOF
#!/usr/bin/env bash
printf 'drush %s\n' "\$*" >> "$app/calls.log"
case "\$*" in
  *"sql:sync"*)
    [ -e "$app/drupal/web/sites/default/files/private/.replacing-database" ] && echo "marker present during sync" >> "$app/calls.log"
    if [ -n "\${STUB_SYNC_SLOW:-}" ]; then
      sleep "\${STUB_SYNC_SLOW}"
      # How old the marker is by the end of a slow copy: the guard opens on
      # this number, so the test reads what the guard would read.
      marker="$app/drupal/web/sites/default/files/private/.replacing-database"
      [ -e "\$marker" ] && expr "\$(date +%s)" - "\$(date -r "\$marker" +%s)" > "$app/marker-age.log"
    fi
    [ "\${STUB_SYNC_FAILS:-}" = "1" ] && exit 1 ;;
  *"status --field=bootstrap"*) [ "$bootstrap" = "yes" ] && echo "Successful" ;;
  *"SELECT COUNT(*) FROM sessions"*) echo "$sessions" ;;
esac
exit 0
EOF
  chmod +x "$app/drupal/vendor/bin/drush"

  cat > "$app/drupal/vendor/bin/php" <<EOF
#!/usr/bin/env bash
printf 'php %s\n' "\$*" >> "$app/calls.log"
exit 0
EOF
  chmod +x "$app/drupal/vendor/bin/php"

  printf '%s' "$app"
}

run_rollout() {
  local app="$1"
  shift
  (cd "$app" && env "$@" PATH="$app/drupal/vendor/bin:$PATH" timeout 60 sh "$app/lagoon/post-rollout.sh" 2>&1)
}

called() {
  grep -qF "$2" "$1/calls.log" 2>/dev/null
}

# --------------------------------------------------------------------------
# Production is never a sync target, and the environment has to say what it
# is before anything is dropped.
# --------------------------------------------------------------------------

app="$(build_app yes)"
output="$(run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=production LAGOON_ENVIRONMENT=main)"
if called "$app" "sql:sync"; then
  no "production by type and name: a sync was attempted"
  printf '%s\n' "$output" | sed 's/^/       /'
else
  ok "production by type and name: nothing was synced"
fi

app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=production LAGOON_ENVIRONMENT=staging > /dev/null
if called "$app" "sql:sync"; then
  no "production by type alone: a sync was attempted"
else
  ok "production by type alone: nothing was synced"
fi

app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=main > /dev/null
if called "$app" "sql:sync"; then
  no "an environment named main: a sync was attempted"
else
  ok "an environment named main: nothing was synced, whatever its type says"
fi

app="$(build_app yes)"
output="$(run_rollout "$app")"
if called "$app" "sql:sync"; then
  no "an environment that says nothing: a sync was attempted"
elif printf '%s' "$output" | grep -q "does not say what it is"; then
  ok "an environment that says nothing: refused, and said why"
else
  no "an environment that says nothing: refused without saying why"
fi

# The negative control. Without this, every assertion above passes against a
# script that never syncs anything.
app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x > /dev/null
if called "$app" "sql:sync @lagoon.druxtjs-org-main @self"; then
  ok "negative control: a feature environment does sync from production"
else
  no "negative control: a feature environment did not sync, so the refusals above prove nothing"
  cat "$app/calls.log" 2>/dev/null | sed 's/^/       /'
fi

# --------------------------------------------------------------------------
# A copy of production is sanitised before the environment is usable.
# --------------------------------------------------------------------------

app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x > /dev/null
for expected in "sql:sanitize" "TRUNCATE TABLE sessions" "TRUNCATE TABLE oauth2_token" "TRUNCATE TABLE watchdog" "UPDATE consumer_field_data"; do
  if called "$app" "$expected"; then
    ok "sanitised: ${expected}"
  else
    no "not sanitised: ${expected}"
  fi
done

# A sanitiser that did nothing must stop the rollout rather than leave
# production credentials in a non-production environment.
app="$(build_app yes 12)"
output="$(run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x)"
status=$?
if [ "$status" -eq 0 ]; then
  no "sanitisation that left sessions behind: the rollout continued"
elif printf '%s' "$output" | grep -q "refusing to leave this environment usable"; then
  ok "sanitisation that left sessions behind: the rollout stopped, and said why"
else
  no "sanitisation that left sessions behind: stopped without saying why"
fi

# --------------------------------------------------------------------------
# Seeding is the last resort, not the routine.
# --------------------------------------------------------------------------

app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x > /dev/null
if called "$app" ".devtools/import"; then
  no "a synced environment: seeded from the pin anyway"
else
  ok "a synced environment: took its content from the sync, not the pin"
fi

app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=production LAGOON_ENVIRONMENT=main > /dev/null
if called "$app" ".devtools/import"; then
  no "production: seeded from the pin"
else
  ok "production: never seeded"
fi

app="$(build_app no)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x > /dev/null
if called "$app" ".devtools/import"; then
  ok "no database to start from: seeded from the pin, because nothing else has the content"
else
  no "no database to start from: nothing installed the content"
fi

app="$(build_app yes)"
output="$(run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x DOCS_SKIP_SYNC=1)"
if called "$app" "sql:sync" || called "$app" "rsync"; then
  no "DOCS_SKIP_SYNC=1: synced anyway"
elif printf '%s' "$output" | grep -q "keeping the database this environment already has"; then
  ok "DOCS_SKIP_SYNC=1: kept the existing database, and said why"
else
  no "DOCS_SKIP_SYNC=1: skipped the sync without saying why"
fi

# Skipping the sync must not start seeding from the pin over a database that
# is already there.
if called "$app" ".devtools/import"; then
  no "DOCS_SKIP_SYNC=1: seeded over the database it was told to keep"
else
  ok "DOCS_SKIP_SYNC=1: left the content alone"
fi

# Production's scheduled dump is preferred over reading its live database.
app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x > /dev/null
if called "$app" "rsync"; then
  ok "tries production's scheduled dump before its live database"
else
  no "went straight to the live database without trying the scheduled dump"
fi

# --------------------------------------------------------------------------
# The deployed revision is recorded last, and only when there is one.
# --------------------------------------------------------------------------

app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=production LAGOON_ENVIRONMENT=main LAGOON_GIT_SHA=abc123 > /dev/null
if called "$app" "state:set druxt_docs.deployed_revision abc123"; then
  ok "records the revision it deployed"
else
  no "did not record the revision it deployed"
fi
if [ "$(grep -n 'state:set druxt_docs.deployed_revision' "$app/calls.log" | cut -d: -f1)" = "$(wc -l < "$app/calls.log")" ]; then
  ok "records it last, after the updates it is claiming"
else
  no "recorded the revision before the rollout had finished"
fi

app="$(build_app yes)"
output="$(run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=production LAGOON_ENVIRONMENT=main)"
if called "$app" "state:set druxt_docs.deployed_revision"; then
  no "recorded a revision when the environment has none"
else
  ok "no revision to record: left it unset, and said so"
fi

# --------------------------------------------------------------------------
# Drupal refuses web requests while its database is replaced, so nothing
# writes into a half-imported database, and the copy leaves out what a
# request would write.
# --------------------------------------------------------------------------

marker_of() { printf '%s/drupal/web/sites/default/files/private/.replacing-database' "$1"; }

app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x > /dev/null
if called "$app" "marker present during sync"; then
  ok "replacing the database: the site refuses requests during the sync"
else
  no "replacing the database: the site was open to requests during the sync"
fi
if [ -e "$(marker_of "$app")" ]; then
  no "replacing the database: still refusing requests after the rollout"
else
  ok "replacing the database: open again once the rollout is done"
fi

# The guard reads the marker's age, so a copy that outlives the guard's
# window has to keep saying it is still going. Under the rule this replaced,
# an hour-long copy ended with the site open and the database half-replaced.
app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x \
  DOCS_REPLACING_HEARTBEAT=1 STUB_SYNC_SLOW=3 STUB_MARKER_AGE=1 > /dev/null
if [ -s "$app/marker-age.log" ] && [ "$(cat "$app/marker-age.log")" -le 2 ]; then
  ok "a copy that outlasts the guard: the marker was still being touched"
else
  no "a copy that outlasts the guard: the marker went stale after $(cat "$app/marker-age.log" 2>/dev/null) seconds"
fi
if [ -e "$(marker_of "$app")" ]; then
  no "a copy that outlasts the guard: a leftover heartbeat put the marker back"
else
  ok "a copy that outlasts the guard: the heartbeat stopped with the rollout"
fi

app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x STUB_SYNC_FAILS=1 > /dev/null
if [ -e "$(marker_of "$app")" ]; then
  no "a failed sync: left the site refusing requests"
else
  ok "a failed sync: the site is open again, to show what failed"
fi

# The negative control: an environment that keeps its database never closes.
app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x DOCS_SKIP_SYNC=1 > /dev/null
if [ -e "$(marker_of "$app")" ] || called "$app" "marker present"; then
  no "no sync: the site refused requests anyway"
else
  ok "no sync: the site never refused requests"
fi

app="$(build_app yes)"
run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x > /dev/null
sync_line="$(grep 'sql:sync' "$app/calls.log")"
# The list as the sync was given it, one table per line, compared exactly.
structure="$(printf '%s' "$sync_line" | sed -n 's/.*--structure-tables-list=\([^ ]*\).*/\1/p' | tr ',' '\n')"
for table in 'cache' 'cache_*' 'cachetags' 'sessions' 'watchdog'; do
  if printf '%s\n' "$structure" | grep -qxF -- "$table"; then
    ok "copied as structure only: ${table}"
  else
    no "copied with its rows: ${table}"
  fi
done

# --------------------------------------------------------------------------
# The frontend's consumer is set up after the updates, on every rollout,
# copied database or installed site alike.
# --------------------------------------------------------------------------

line_of() { grep -n -F -- "$2" "$1/calls.log" | head -1 | cut -d: -f1; }

for bootstrap in yes no; do
  app="$(build_app "$bootstrap")"
  run_rollout "$app" LAGOON_ENVIRONMENT_TYPE=development LAGOON_ENVIRONMENT=feature-x > /dev/null
  step="$( [ "$bootstrap" = yes ] && echo deploy || echo site:install )"
  client="$(line_of "$app" 'druxtjsorg:oauth-client')"
  update="$(line_of "$app" "$step")"
  if [ -n "$client" ] && [ -n "$update" ] && [ "$client" -gt "$update" ]; then
    ok "sets up the sign-in consumer after ${step}"
  else
    no "did not set up the sign-in consumer after ${step} (client line: ${client:-none}, ${step} line: ${update:-none})"
  fi
done

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
