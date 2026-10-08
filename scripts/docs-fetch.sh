#!/usr/bin/env sh
# Checks out the druxt.js commit docs-source.json pins into .docs-source, for
# docgen to generate the Modules, API reference and Components pages in.
# DOCS_REPOSITORY fetches the same commit from a mirror.
set -eu
cd "$(dirname "$0")/.."

repository=$(node -p "require('./docs-source.json').repository")
ref=$(node -p "require('./docs-source.json').ref")
repository="${DOCS_REPOSITORY:-$repository}"
dir=.docs-source

if [ -d "$dir/.git" ] && [ "$(git -C "$dir" rev-parse HEAD 2>/dev/null)" = "$ref" ]; then
  echo "$dir is at $ref."
  exit 0
fi

rm -rf "$dir"
git init -q "$dir"
git -C "$dir" fetch -q --depth 1 "$repository" "$ref"
git -C "$dir" checkout -q FETCH_HEAD
echo "$dir is at $ref."
