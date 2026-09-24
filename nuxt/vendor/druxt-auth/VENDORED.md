# Vendored: druxt-auth

The built package from druxt/druxt-auth#84, carried here until a release
carries it. Only what the package publishes is copied: `dist`, `templates`,
the manifest without its scripts and development dependencies, the licence
and the README.

| | |
| --- | --- |
| Package | `druxt-auth` |
| Commit | `68702b0` |
| Pull request | druxt/druxt-auth#84 |

The site needs #84 rather than the published build because the password
grant has to open a Drupal session as well as issue a token. Without one,
Drupal's own screens are anonymous, so the editor bar's Edit links, the
drafts listing and the profile form all send the reader to a login page
that tells them they are already signed in.

Replace `file:vendor/druxt-auth` in `package.json` with the published
version once one carries #84, and delete this directory.
