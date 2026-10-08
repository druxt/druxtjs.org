# GitHub Environments

The repository's Environments on GitHub mirror the Lagoon project. Each Lagoon
environment has one GitHub environment of the same name, with a deployment
whose URL is the frontend route, and an environment Lagoon no longer runs is
removed. Lagoon writes nothing to GitHub itself, so without this the
Deployments panel keeps every branch an earlier workflow ever deployed.

The `Environments` workflow keeps them equal. It runs every hour, when a
branch is deleted, and on request from the Actions tab.

## What it needs

The workflow reads two repository secrets.

| Secret               | Holds                                                                                     | Used for                                                          |
| -------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `LAGOON_SSH_KEY`     | A private SSH key whose public half is on a Lagoon user that can read the project         | Signing in to Lagoon and reading the environments                 |
| `ENVIRONMENTS_TOKEN` | A fine-grained token for this repository with Administration and Deployments set to write | Deleting an environment, which the workflow's own token cannot do |

Without `ENVIRONMENTS_TOKEN` the workflow still records deployments, lists the
environments it would delete, and fails, so the gap shows in the run.

The Lagoon project is named in the workflow's `LAGOON_PROJECT` variable.

## Running it by hand

With the Lagoon CLI signed in and a GitHub token in `GITHUB_TOKEN`:

```sh
lagoon raw --raw "$(node scripts/sync-environments.mjs --query druxtjs-org)" > lagoon.json
node scripts/sync-environments.mjs --lagoon lagoon.json --repo druxt/druxtjs.org --dry-run
```

The dry run prints one line per environment, `create`, `update`, `keep`,
`delete` or `skip`, and changes nothing. Leave off `--dry-run` to apply it.

## Branch deletion

Lagoon removes a branch's environment when GitHub sends it the branch
deletion, which the repository's Lagoon webhook does since the `delete` event
was added to it. A merged pull request deletes its branch, so a merge takes
its environment with it. The workflow run on that deletion waits three
minutes for Lagoon before it reads the environments, and the hourly run
catches anything that took longer.
