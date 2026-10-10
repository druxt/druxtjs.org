#!/usr/bin/env sh
# Creates or removes a staging environment on Lagoon.
#
#   scripts/staging.sh create <name> [--from <ref>] [--target <url>]
#   scripts/staging.sh remove <name>
#
# A staging environment is the branch `staging/<name>`, cut from `main` so
# it runs production's code, and built like any other: its first rollout
# copies production. From then on it keeps its database (lagoon/post-rollout.sh),
# so a workspace deployed to it for review survives its own redeploys.
#
# It sits between a local backend and production. Local signs its deploys
# with the project's key, which staging accepts; staging signs with the key
# production accepts, which only staging and production hold. The script
# reads both from Lagoon and sets them on the new environment, with its
# target, after the first build, then deploys it again so the settings take.
#
# Needs: the lagoon CLI signed in, node, and a git remote for the GitHub
# repository Lagoon builds from. The keys never touch the working tree.
set -eu

project="${LAGOON_PROJECT:-druxtjs-org}"
production="${LAGOON_PRODUCTION_ENVIRONMENT:-main}"

usage() {
  sed -n '2,5p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

fail() {
  echo "$*" >&2
  exit 1
}

# One field of a variable, from the project's or an environment's list.
# Lagoon's JSON lists every variable with its name and value; node reads
# it, since the value is a secret that must not go through a shell pattern.
variable() {
  # $1 scope flag (empty for the project), $2 name
  # shellcheck disable=SC2086
  lagoon list variables -p "$project" $1 --reveal --output-json 2>/dev/null \
    | node -e '
      let input = "";
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const parsed = JSON.parse(input || "{}");
        const rows = Array.isArray(parsed) ? parsed : parsed.data || [];
        const row = rows.find((r) => r.name === process.argv[1]);
        if (row && row.value) process.stdout.write(row.value);
      });
    ' "$2"
}

remote() {
  if [ -n "${DOCS_DEPLOY_REMOTE:-}" ]; then
    echo "$DOCS_DEPLOY_REMOTE"
    return
  fi
  git remote -v | awk '/github\.com[:\/]druxt\/druxtjs\.org/ && /\(push\)/ { print $1; exit }'
}

environment_field() {
  # $1 environment, $2 field
  lagoon get environment -p "$project" -e "$1" --output-json 2>/dev/null \
    | node -e '
      let input = "";
      process.stdin.on("data", (chunk) => { input += chunk; });
      process.stdin.on("end", () => {
        const parsed = JSON.parse(input || "{}");
        const row = Array.isArray(parsed.data) ? parsed.data[0] : parsed;
        process.stdout.write(String((row && row[process.argv[1]]) || ""));
      });
    ' "$2"
}

# Waits for the environment's newest deployment to finish, and says how.
wait_for_build() {
  # $1 environment, $2 what is being waited for
  echo "Waiting for $2."
  attempts=0
  while :; do
    status="$(lagoon list deployments -p "$project" -e "$1" --output-json 2>/dev/null \
      | node -e '
        let input = "";
        process.stdin.on("data", (chunk) => { input += chunk; });
        process.stdin.on("end", () => {
          const parsed = JSON.parse(input || "{}");
          const rows = Array.isArray(parsed) ? parsed : parsed.data || [];
          process.stdout.write(rows.length ? String(rows[0].status || "") : "");
        });
      ')"
    case "$status" in
      complete) echo "  built."; return 0 ;;
      failed | cancelled | error) fail "  the build ${status}; see 'lagoon list deployments -p $project -e $1'." ;;
    esac
    attempts=$((attempts + 1))
    [ "$attempts" -lt 120 ] || fail "  still not built after twenty minutes; look at it in Lagoon."
    sleep 10
  done
}

set_variable() {
  # $1 environment, $2 name, $3 value
  lagoon delete variable -p "$project" -e "$1" -N "$2" --force > /dev/null 2>&1 || :
  lagoon add variable -p "$project" -e "$1" -N "$2" -V "$3" -S runtime --force > /dev/null
  echo "  $2 set."
}

create() {
  name="$1"
  from="main"
  target="https://druxtjs.org"
  shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --from) from="$2"; shift 2 ;;
      --target) target="$2"; shift 2 ;;
      *) usage ;;
    esac
  done
  branch="staging/$name"

  remote="$(remote)"
  [ -n "$remote" ] || fail "No git remote for the GitHub repository; set DOCS_DEPLOY_REMOTE to the one Lagoon builds from."

  local_key="$(variable "" WSE_DEPLOY_KEY)"
  [ -n "$local_key" ] || fail "The project has no WSE_DEPLOY_KEY; local machines sign with it, and staging must accept it."
  staging_key="${WSE_DEPLOY_STAGING_KEY:-$(variable "-e $production" WSE_DEPLOY_ACCEPT_KEY)}"
  [ -n "$staging_key" ] || fail "$production has no WSE_DEPLOY_ACCEPT_KEY; staging signs with it, and nothing else may hold it."

  echo "Pushing $from to $branch on $remote."
  git push "$remote" "$from:refs/heads/$branch"

  echo "Waiting for Lagoon to notice the branch."
  attempts=0
  until [ -n "$(environment_field "$branch" id)" ]; do
    attempts=$((attempts + 1))
    [ "$attempts" -lt 30 ] || fail "Lagoon has not created $branch after five minutes; is '^staging/.+\$' in the project's branch rule?"
    sleep 10
  done
  wait_for_build "$branch" "its first build, which copies production"

  echo "Setting the deploy settings on $branch."
  set_variable "$branch" WSE_DEPLOY_TARGET "$target"
  set_variable "$branch" WSE_DEPLOY_KEY "$staging_key"
  set_variable "$branch" WSE_DEPLOY_ACCEPT_KEY "$local_key"

  echo "Deploying $branch again, so the settings take; its database is kept."
  lagoon deploy latest -p "$project" -e "$branch" --force > /dev/null
  wait_for_build "$branch" "the second build"

  # Lagoon names the environment by its nginx route; the site is the nuxt one.
  route="$(environment_field "$branch" route | sed 's#^https://nginx\.#https://nuxt.#')"
  echo
  echo "Staging is up at ${route:-its route in Lagoon}."
  echo "A local backend deploys to it with that URL as its target, and it deploys to $target."
}

remove() {
  name="$1"
  branch="staging/$name"
  remote="$(remote)"
  [ -n "$remote" ] || fail "No git remote for the GitHub repository; set DOCS_DEPLOY_REMOTE to the one Lagoon builds from."
  echo "Deleting $branch on $remote; Lagoon removes the environment with it."
  git push "$remote" --delete "$branch"
}

[ $# -ge 2 ] || usage
command="$1"
name="$2"
shift 2
case "$name" in
  *[!a-z0-9-]* | "" | -*) fail "A staging name is lower-case letters, digits and hyphens: '$name' is not." ;;
esac
case "$command" in
  create) create "$name" "$@" ;;
  remove) [ $# -eq 0 ] || usage; remove "$name" ;;
  *) usage ;;
esac
