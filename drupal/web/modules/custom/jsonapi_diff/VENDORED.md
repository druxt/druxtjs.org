# Vendored: JSON:API Diff

A copy of the `drupal/jsonapi_diff` module, carried here until it is
published. Only the files Drupal loads are copied: no tests, tooling or
documentation. The project's own README stays with the project.

| | |
| --- | --- |
| Project | `drupal/jsonapi_diff` |
| Commit | `d736153` |

One change here is ahead of the project: `TreeBuilder` gives every child diff
the whole tree's cacheability, so a child's cached normalization varies by
every access decision taken for the tree. Land it in the project before
replacing this directory.

Replace this directory with a Composer requirement once the project is
published, and delete this file.
