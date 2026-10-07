#!/usr/bin/env sh
# The release notes of a development snapshot: druxt.js's pending changesets,
# written into each package's CHANGELOG.md in a throwaway checkout, before
# docgen copies them into the API reference.
#
# changesets stamps the versions with the time it runs. Every stamp is set
# back to the snapshot's own build time, in the notes and in the packages, so
# the notes and the version badge name the build the site installs. The
# checkout needs its history, which changesets reads to link each entry to
# its commit: a blobless fetch has it, a shallow one does not.
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
for file in packages/*/CHANGELOG.md packages/*/package.json; do
  sed -i -E "s/-dev\.[0-9]{14}/-dev.${stamp}/g" "$file"
done
