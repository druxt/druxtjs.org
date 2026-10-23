#!/usr/bin/env sh
# Generates the Modules, API reference and Components pages with druxt.js's own
# docgen, into the content checkout nuxt/content links to. They are generated
# from the packages, not written in Drupal.
#
# docgen runs at `docgenRef` in docs-source.json, in its own checkout in
# .docs-api, so the reference can follow the packages the site installs while
# the authored markdown in .docs-source stays at `ref`. druxt.js no longer
# carries that markdown, so `ref` cannot move with the packages.
#
# The checkout's .mise.toml pins its own Node. It is not this repository's, so
# mise is told to trust it for this run, alongside whatever is trusted already.
set -eu
cd "$(dirname "$0")/.."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

content="$PWD/.docs-source/docs/nuxt/content"
if [ ! -d "$content" ]; then
  echo "No documentation checkout in .docs-source. Run npm run setup first." >&2
  exit 1
fi

pin() { node -p "const p = require('./docs-source.json'); p.$1 || p.ref"; }
repository=${DOCS_REPOSITORY:-$(pin repository)}
ref=$(pin docgenRef)

src="$PWD/.docs-api"
if [ "$(git -C "$src" rev-parse HEAD 2>/dev/null)" != "$ref" ]; then
  rm -rf "$src"
  git init -q "$src"
  git -C "$src" fetch -q --depth 1 "$repository" "$ref"
  git -C "$src" checkout -q FETCH_HEAD
fi
cd "$src"

run() {
  if command -v mise > /dev/null 2>&1; then
    MISE_TRUSTED_CONFIG_PATHS="$src${MISE_TRUSTED_CONFIG_PATHS:+:$MISE_TRUSTED_CONFIG_PATHS}" mise exec -- "$@"
  else
    "$@"
  fi
}

run corepack yarn install
run corepack yarn build
run node packages/docgen/bin/druxt-docgen.js --destination "$content"
echo "Generated pages from druxt.js ${ref} are in .docs-source/docs/nuxt/content, which nuxt/content links to."
