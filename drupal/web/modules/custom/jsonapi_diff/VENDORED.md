# Vendored: JSON:API Diff

A copy of the `drupal/jsonapi_diff` module, carried here until it is
published. Only the files Drupal loads are copied: no tests, tooling or
documentation. The project's own README stays with the project.

| | |
| --- | --- |
| Project | `drupal/jsonapi_diff` |
| Commit | `d736153` |

These changes are ahead of the project. Land them there before replacing this
directory:

- `TreeBuilder` gives every child diff the whole tree's cacheability, so a
  child's cached normalization varies by every access decision taken for the
  tree.
- `DiffResourceObject` links a side to its revision only for a resource type
  JSON:API keeps versions of. It answers 400 to `resourceVersion` on any
  other, such as a paragraph.

Replace this directory with a Composer requirement once the project is
published, and delete this file.
