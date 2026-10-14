# Vendored: consumer_node_preview

A copy of the Consumer Node Preview module, carried here until it is released
on Drupal.org, when `composer require drupal/consumer_node_preview` replaces
this directory.

| | |
| --- | --- |
| Commit | `de20cdb` (branch `feature/1-preview-layouts`) |
| Taken | What `git archive de20cdb` exports, which the module's `.gitattributes` keeps to the distributed set, without the four files that still slip through it (`.gitlab-ci.yml`, `CONTRIBUTING.md`, `phpunit.gitlab-ci.xml`, `phpunit.gitlab-ci.d10.xml`), plus its tests, which the export leaves out and the site's suite runs |
| Changed | The browser tests under `tests/src/FunctionalJavascript` are left out: the site's suite runs without a WebDriver. The archive also leaves out `docs/`, so the README's screenshot does not render in this copy |
