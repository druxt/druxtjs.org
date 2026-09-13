#!/usr/bin/env sh
# Runs the Nuxt dev server against the backend .devtools/start wrote to .env.
# nuxt.config.js reads DRUXT_BASE_URL, so BASE_URL fills it in when it is unset.
set -eu
cd "$(dirname "$0")/.."
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

if [ -z "${DRUXT_BASE_URL:-}" ] && [ -f .env ]; then
  DRUXT_BASE_URL="$(sed -n 's/^BASE_URL=//p' .env | head -n 1)"
fi
if [ -z "${DRUXT_BASE_URL:-}" ]; then
  echo "No backend URL. Run npm run start (or npm run setup) first, or set DRUXT_BASE_URL." >&2
  exit 1
fi
export DRUXT_BASE_URL
echo "Backend: $DRUXT_BASE_URL"

cd nuxt
[ -d node_modules ] || corepack yarn install --immutable
exec corepack yarn dev "$@"
