#!/usr/bin/env bash
# Guards .devtools/start against reporting success for a server it never
# started.
#
# The bug this exists for: start probed the port with fsockopen() and then
# requested the URL, and both checks pass against whatever process already
# holds that port. A failed bind therefore read exactly like a successful
# start, printed a login link for a stranger's server, and exited 0. Caught
# live against an unrelated python server, which answered 200 with its own
# page.
#
# Both cases below fail before Drupal is touched, so this needs only PHP and
# the scripts: no composer install, no provision, no database.

set -uo pipefail

cd "$(dirname "$0")/.."

readonly DRUPAL_DIR="$PWD/drupal"
readonly START="${START_SCRIPT:-$DRUPAL_DIR/.devtools/start}"

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

# A port nothing is listening on right now.
free_port() {
  python3 - <<'PY'
import socket
s = socket.socket()
s.bind(('127.0.0.1', 0))
print(s.getsockname()[1])
s.close()
PY
}

# --------------------------------------------------------------------------
# A port another process holds must be refused, not adopted.
# --------------------------------------------------------------------------

port="$(free_port)"
python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1 &
squatter=$!
trap 'kill "$squatter" 2>/dev/null' EXIT

# Give the squatter a moment to bind, so the test is not racing it.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if python3 -c "import socket,sys; s=socket.socket(); sys.exit(0 if s.connect_ex(('127.0.0.1', $port)) == 0 else 1)"; then
    break
  fi
  sleep 0.2
done

# This checkout's server on another port, as a developer would have it
# running. The pidfile path comes from the helper, not a copy of it.
other="$(free_port)"
(cd "$DRUPAL_DIR/web" && exec php -S "127.0.0.1:$other" -t . >/dev/null 2>&1) &
running=$!
pid_file="$(cd "$DRUPAL_DIR" && php -r 'require ".devtools/helpers.php"; echo DocsDevTools\server_pid_file($argv[1]);' -- "$other")"
printf '%s\n' "$running" > "$pid_file"
trap 'kill "$squatter" "$running" 2>/dev/null; rm -f "$pid_file"' EXIT
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if python3 -c "import socket,sys; s=socket.socket(); sys.exit(0 if s.connect_ex(('127.0.0.1', $other)) == 0 else 1)"; then
    break
  fi
  sleep 0.2
done

output="$(cd "$DRUPAL_DIR" && WEBSERVER_PORT="$port" timeout 60 "$START" 2>&1)"
status=$?

# Assert on the message, in both directions, not on the exit code alone.
# A crash and a correct refusal are the same number to $?, so a broken copy
# of the script that dies before reaching the guard would otherwise read as
# the guard firing. Caught exactly that way while proving this test can go
# red: a stripped copy placed outside .devtools/ fatalled on its
# `require_once __DIR__ . '/helpers.php'`, exited 255, and looked like a pass.
if printf '%s' "$output" | grep -qE 'Fatal error|Uncaught|command not found'; then
  no "start crashed rather than refusing; this run proves nothing either way"
  printf '%s\n' "$output" | sed 's/^/       /'
elif printf '%s' "$output" | grep -q 'ENVIRONMENT READY'; then
  no "start reported success against a port it never bound"
  printf '%s\n' "$output" | sed 's/^/       /'
elif printf '%s' "$output" | grep -q 'already in use'; then
  ok "start refuses a port another process holds, and names why (exit $status)"
else
  no "start neither succeeded nor refused for the stated reason"
  printf '%s\n' "$output" | sed 's/^/       /'
fi

# Only meaningful once the run above is known to be a refusal rather than a
# crash, since a crash exits non-zero too.
if printf '%s' "$output" | grep -qE 'Fatal error|Uncaught|command not found'; then
  printf '[SKIP] exit status says nothing about a run that crashed\n'
elif [ "$status" -ne 0 ]; then
  ok "the refusal exits non-zero (exit $status)"
else
  no "start exited 0 despite not starting a server"
fi

# The squatter must survive: start stops only the server its own pidfile
# names, and must never kill a process it did not launch.
if kill -0 "$squatter" 2>/dev/null; then
  ok "start left the unrelated process alone"
else
  no "start killed a process it did not start"
fi

# A start on one port must not stop this checkout's server on another. A
# pidfile shared by every port once made running this suite do exactly that.
if kill -0 "$running" 2>/dev/null; then
  ok "start left this checkout's server on another port running"
else
  no "start stopped this checkout's server on another port"
fi

kill "$squatter" "$running" 2>/dev/null
rm -f "$pid_file"
trap - EXIT

# --------------------------------------------------------------------------
# The server log is passed to the error reporter as an argument, never as a
# format string, so a % in a PHP error cannot break the report.
# --------------------------------------------------------------------------

if grep -qE "FAIL\('[^']*'\s*\.\s*\(\\\$log" "$START"; then
  no "a server log is concatenated into a FAIL() format string"
else
  ok "no server log is concatenated into a FAIL() format string"
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
