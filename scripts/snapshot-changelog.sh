#!/usr/bin/env sh
# The release notes of a development snapshot: druxt.js's pending changesets,
# written into each package's CHANGELOG.md in a throwaway checkout, before
# docgen copies them into the API reference.
#
# changesets heads each entry with the time it runs. The heading is set back
# to the snapshot's own build time, so the notes name the version the site
# installs. The checkout needs its history, which changesets reads to link
# each entry to its commit: a blobless fetch has it, a shallow one does not.
#
# Usage: snapshot-changelog.sh <druxt.js checkout> <build time YYYYMMDDhhmmss>
set -eu

checkout="$1"
stamp="$2"
case "$stamp" in
  [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
  *) echo "Not a build time: $stamp" >&2; exit 1 ;;
esac

cd "$checkout"
node node_modules/@changesets/cli/bin.js version --snapshot dev
for changelog in packages/*/CHANGELOG.md; do
  sed -i -E "s/^(## [0-9]+\.[0-9]+\.[0-9]+-dev\.)[0-9]{14}$/\1${stamp}/" "$changelog"
done
