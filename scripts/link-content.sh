#!/usr/bin/env sh
# Links nuxt/content to the pinned documentation checkout .devtools/import
# fetched into .docs-source. Both are gitignored.
set -eu
cd "$(dirname "$0")/.."

if [ ! -d .docs-source/docs/nuxt/content ]; then
  echo "No documentation checkout in .docs-source. Run npm run import first." >&2
  exit 1
fi
if [ -e nuxt/content ] && [ ! -L nuxt/content ]; then
  echo "nuxt/content exists and is not a link. Move it aside, then run this again." >&2
  exit 1
fi
ln -sfn ../.docs-source/docs/nuxt/content nuxt/content
echo "nuxt/content -> .docs-source/docs/nuxt/content"
