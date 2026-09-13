#!/usr/bin/env bash
# Guards .devtools/import against building content from anything other
# than what the pin names.
#
# Every case below fails before Drupal is touched, so this needs PHP, node
# and git: no composer install, no provision, no database. The import and
# export steps are exercised by the import job in CI, against a
# provisioned site.
#
# Each refusal is asserted on its message, in both directions. A crash and
# a correct refusal are the same number to $?, so exit codes alone would
# let a broken script read as the guard firing.

set -uo pipefail

cd "$(dirname "$0")/.."

readonly REPO_ROOT="$PWD"
readonly IMPORT="$REPO_ROOT/drupal/.devtools/import"
readonly PIN="$REPO_ROOT/docs-source.json"
readonly PINNED_REF="$(node -p "JSON.parse(require('fs').readFileSync('$PIN','utf8')).ref")"

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

crashed() {
  printf '%s' "$1" | grep -qE 'Fatal error|Uncaught|command not found'
}

# Run import from a scratch copy of the repository, so a case can break the
# pin, the builder or the checkout without touching the real one. The copy
# carries the .devtools scripts, the pin, the builder and node_modules;
# nothing else is needed before Drupal is reached.
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

fresh_copy() {
  local dir="$scratch/repo-$RANDOM"
  mkdir -p "$dir/drupal"
  cp -R "$REPO_ROOT/drupal/.devtools" "$dir/drupal/.devtools"
  cp -R "$REPO_ROOT/scripts" "$dir/scripts"
  cp "$PIN" "$dir/docs-source.json"
  if [ -d "$REPO_ROOT/node_modules" ]; then
    ln -s "$REPO_ROOT/node_modules" "$dir/node_modules"
  fi
  printf '%s' "$dir"
}

run_import() {
  local dir="$1"
  shift
  (cd "$dir/drupal" && env "$@" timeout 120 "$IMPORT" 2>&1)
}

# A git checkout with one commit and no documentation in it.
fake_checkout() {
  local dir="$scratch/docs-$RANDOM"
  mkdir -p "$dir"
  git -C "$dir" init -q
  git -C "$dir" -c user.name=test -c user.email=test@example.com commit -q --allow-empty -m init
  printf '%s' "$dir"
}

# A git checkout holding a two-page corpus the real builder accepts.
docs_checkout() {
  local dir
  dir="$(fake_checkout)"
  mkdir -p "$dir/docs/nuxt/content/how-to"
  printf -- '---\ntitle: Proxy\ndescription: Route API calls through Nuxt.\n---\n# Proxy\n\nSee [the tutorials](/tutorials).\n\n```js\nexport default { proxy: true }\n```\n' > "$dir/docs/nuxt/content/how-to/proxy.md"
  mkdir -p "$dir/docs/nuxt/content/tutorials"
  printf -- '---\ntitle: Tutorials\ndescription: Learn Druxt step by step.\n---\n# Tutorials\n\nStart here.\n' > "$dir/docs/nuxt/content/tutorials/README.md"
  git -C "$dir" add -A
  git -C "$dir" -c user.name=test -c user.email=test@example.com commit -q -m corpus
  printf '%s' "$dir"
}

assert_refusal() {
  local label="$1" output="$2" status="$3" expected="$4"
  if crashed "$output"; then
    no "$label: crashed rather than refusing; this run proves nothing either way"
    printf '%s\n' "$output" | sed 's/^/       /'
  elif printf '%s' "$output" | grep -q 'IMPORT COMPLETE'; then
    no "$label: reported success"
    printf '%s\n' "$output" | sed 's/^/       /'
  elif printf '%s' "$output" | grep -q -- "$expected"; then
    if [ "$status" -ne 0 ]; then
      ok "$label: refused, named why, exited non-zero (exit $status)"
    else
      no "$label: refused but exited 0"
    fi
  else
    no "$label: neither succeeded nor refused for the stated reason"
    printf '%s\n' "$output" | sed 's/^/       /'
  fi
}

# --------------------------------------------------------------------------
# The pin has to exist and name exactly one commit.
# --------------------------------------------------------------------------

repo="$(fresh_copy)"
rm "$repo/docs-source.json"
output="$(run_import "$repo")"
assert_refusal "missing pin" "$output" $? "No pin file"

repo="$(fresh_copy)"
printf '{"repository":"https://example.com/docs.git","ref":"develop"}' > "$repo/docs-source.json"
output="$(run_import "$repo")"
assert_refusal "branch name as ref" "$output" $? "not a full commit sha"

repo="$(fresh_copy)"
printf '{"ref":"%s"}' "$PINNED_REF" > "$repo/docs-source.json"
output="$(run_import "$repo")"
assert_refusal "pin without a repository" "$output" $? 'missing "repository"'

# --------------------------------------------------------------------------
# A checkout override is for building, never for checking.
# --------------------------------------------------------------------------

repo="$(fresh_copy)"
docs="$(fake_checkout)"
output="$(cd "$repo/drupal" && DOCS_CHECKOUT="$docs" timeout 120 "$IMPORT" --check 2>&1)"
assert_refusal "--check with DOCS_CHECKOUT" "$output" $? "only ever builds from the pinned commit"

repo="$(fresh_copy)"
output="$(run_import "$repo" DOCS_CHECKOUT="$scratch/not-a-checkout")"
assert_refusal "DOCS_CHECKOUT that is not a git checkout" "$output" $? "not a git checkout"

# --------------------------------------------------------------------------
# The builder refuses a checkout with no documentation in it, and its
# failure is the run's.
# --------------------------------------------------------------------------

repo="$(fresh_copy)"
docs="$(fake_checkout)"
output="$(run_import "$repo" DOCS_CHECKOUT="$docs")"
assert_refusal "checkout that is not the documentation repository" "$output" $? "IR builder failed"
if printf '%s' "$output" | grep -q 'No tracked files under docs/nuxt/content'; then
  ok "the builder named the empty corpus"
else
  no "the builder did not name the empty corpus"
fi

repo="$(fresh_copy)"
docs="$(fake_checkout)"
printf '#!/usr/bin/env node\nconsole.error("content/how-to/x.md:3 fence in a language the model does not accept")\nprocess.exit(3)\n' > "$repo/scripts/build-ir.mjs"
output="$(run_import "$repo" DOCS_CHECKOUT="$docs")"
assert_refusal "builder that fails" "$output" $? "IR builder failed"
if printf '%s' "$output" | grep -q 'fence in a language'; then
  ok "the builder's own error reaches the output"
else
  no "the builder's own error was swallowed"
fi

repo="$(fresh_copy)"
docs="$(fake_checkout)"
printf '#!/usr/bin/env node\nimport { mkdirSync } from "node:fs"\nmkdirSync(process.argv[5], {recursive: true})\n' > "$repo/scripts/build-ir.mjs"
output="$(run_import "$repo" DOCS_CHECKOUT="$docs")"
assert_refusal "builder that writes nothing" "$output" $? "wrote no documents"

# --------------------------------------------------------------------------
# A corpus the builder accepts reaches the import step, which needs a
# provisioned site. The refusal there names what is missing.
# --------------------------------------------------------------------------

repo="$(fresh_copy)"
docs="$(docs_checkout)"
output="$(run_import "$repo" DOCS_CHECKOUT="$docs")"
assert_refusal "import without a provisioned site" "$output" $? "vendor/bin/drush is missing"
if printf '%s' "$output" | grep -q '2 documents written'; then
  ok "the builder's output was counted before the import step"
else
  no "the builder ran but its output was not reported"
fi
if [ -f "$repo/.docs-ir/how-to__proxy.json" ] && [ -f "$repo/.docs-ir/tutorials__README.json" ]; then
  ok "one IR document per page, named from the content path"
else
  no "the IR documents are not where the importer reads them"
  ls "$repo/.docs-ir" 2>&1 | sed 's/^/       /'
fi

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
