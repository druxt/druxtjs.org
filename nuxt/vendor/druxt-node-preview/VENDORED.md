# Vendored: @druxt-contrib/node-preview

The built package, carried here until it is published. Only what the
package publishes is copied: `dist`, `templates`, the manifest without its
scripts and development dependencies, the licence and the README.

| | |
| --- | --- |
| Package | `@druxt-contrib/node-preview` |
| Commit | `09c9ae88` |

The manifest differs in one way from the source. The package pins its
`druxt` peer to one minor (`^0.21.0`), which on a 0.x version excludes the
0.24 and later this site runs, so the copy widens it to `>=0.21.0 <1` and the
site's own `druxt` serves it with no second copy installed.

Replace `file:vendor/druxt-node-preview` in `package.json` with the published
version once it is on npm, and delete this directory.
