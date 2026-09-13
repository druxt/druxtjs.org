#!/usr/bin/env sh
# Audits nuxt/'s production dependencies with Yarn's own audit. The frontend's
# Yarn 3.8.7 calls a registry endpoint that now answers 400, so the lockfile is
# migrated to Yarn 4 in a scratch copy and audited there. The resolved versions
# carry over, and nuxt/ itself is not touched. Yarn 4 needs Node 18 or later.
set -eu
cd "$(dirname "$0")/.."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cp nuxt/package.json nuxt/yarn.lock "$work/"
printf 'nodeLinker: node-modules\nenableGlobalCache: true\n' > "$work/.yarnrc.yml"
cd "$work"
corepack yarn@4.9.2 install --mode=update-lockfile > /dev/null
corepack yarn@4.9.2 npm audit --all --recursive --environment production --severity high
