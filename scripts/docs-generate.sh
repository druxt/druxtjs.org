#!/usr/bin/env sh
# Generates the Modules, API reference and Components pages with druxt.js's own
# docgen, in the pinned checkout nuxt/content links to. They are generated from
# the packages, not written in Drupal.
#
# The checkout's .mise.toml pins its own Node. It is not this repository's, so
# mise is told to trust it for this run, alongside whatever is trusted already.
set -eu
cd "$(dirname "$0")/.."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

src="$PWD/.docs-source"
if [ ! -d "$src/.git" ]; then
  echo "No documentation checkout in .docs-source. Run npm run setup first." >&2
  exit 1
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
run corepack yarn build:docs
echo "Generated pages are in .docs-source/docs/nuxt/content, which nuxt/content links to."
