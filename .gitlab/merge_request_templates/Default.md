<!--
Title this merge request the way you would title a commit:

    <type>(<scope>): <description>

A squash merge makes the title the commit subject. A prose title passes review
and then breaks the next push to the target branch.
-->

## What changed

## Why

## How it was checked

- [ ] `npm run lint` passes
- [ ] `npm test` and the guardrail tests in `tests/` pass
- [ ] `vendor/bin/phpunit` passes in `drupal/`, if PHP changed
- [ ] Configuration exported with `drush config:export`, if the site's configuration changed
- [ ] Nothing that resolves only on a private network reached a tracked file
