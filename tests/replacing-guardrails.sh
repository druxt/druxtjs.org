#!/usr/bin/env bash
# Guards drupal/web/sites/default/settings.replacing.php, which turns web
# requests away while lagoon/post-rollout.sh replaces the database.
#
# It is served by `php -S`, whose SAPI is a web one, so each case is a real
# request. Every refusal is paired with a case that is let through, or a
# guard that refused everything would pass.

set -uo pipefail

cd "$(dirname "$0")/.."

readonly GUARD="$PWD/drupal/web/sites/default/settings.replacing.php"

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
server=""
trap '[ -n "$server" ] && kill "$server" 2>/dev/null; rm -rf "$scratch"' EXIT

# A docroot laid out like sites/default: the guard, then what Drupal would do.
site="$scratch/default"
mkdir -p "$site/files/private"
cp "$GUARD" "$site/settings.replacing.php"
printf '<?php\nrequire __DIR__ . "/settings.replacing.php";\nprint "drupal";\n' > "$site/index.php"
marker="$site/files/private/.replacing-database"

# A port nothing else holds, proven by the server answering with our page.
for port in $(seq 18750 18790); do
  php -S "127.0.0.1:$port" -t "$site" > "$scratch/server.log" 2>&1 &
  server=$!
  for _ in $(seq 50); do
    [ "$(curl -s "http://127.0.0.1:$port/index.php")" = "drupal" ] && break 2
    kill -0 "$server" 2>/dev/null || break
    sleep 0.1
  done
  kill "$server" 2>/dev/null
  server=""
done
if [ -z "$server" ]; then
  echo "Could not start a PHP server for the guard."
  exit 1
fi

request() {
  curl -s -o "$scratch/body" -w '%{http_code}' "http://127.0.0.1:$port/index.php"
}

rm -f "$marker"
if [ "$(request)" = "200" ] && [ "$(cat "$scratch/body")" = "drupal" ]; then
  ok "no replacement under way: the request reaches Drupal"
else
  no "no replacement under way: the request was turned away"
fi

: > "$marker"
code="$(request)"
if [ "$code" = "503" ] && ! grep -q drupal "$scratch/body"; then
  ok "during a replacement: 503, and Drupal is never reached"
else
  no "during a replacement: ${code}, and the request reached Drupal"
fi
if curl -s -D - -o /dev/null "http://127.0.0.1:$port/index.php" | grep -qi '^Retry-After: 30'; then
  ok "during a replacement: says when to try again"
else
  no "during a replacement: no Retry-After"
fi

touch -d '2 hours ago' "$marker"
if [ "$(request)" = "200" ]; then
  ok "a marker left by a killed rollout: ignored after an hour"
else
  no "a marker left by a killed rollout: still holding the site down"
fi

# Drush runs on the cli SAPI and must still reach the database it is loading.
: > "$marker"
if [ "$(php "$site/index.php")" = "drupal" ]; then
  ok "drush during a replacement: let through"
else
  no "drush during a replacement: turned away"
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
