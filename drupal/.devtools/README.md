Local development without Docker. Just PHP, Composer, and SQLite.

## Scripts

| Script | What it does |
| --- | --- |
| `assemble` | Install Composer dependencies. |
| `provision` | Install Drupal fresh from the committed configuration and content. |
| `start` | Start the PHP dev server. Write `BASE_URL` to `../.env`. |
| `stop` | Stop the dev server. |
| `info` | Show the current environment: PHP, Drupal, Composer, and Drush versions, webserver, database. |
| `import` | Build the documentation from its pinned source, check it against the checkout and the baseline, and import it into the provisioned site. Fails unless the site ends up holding a page for every document the source produced, and every page's computed table of contents matches the IR's. `--check` refuses to build from anything but the pinned commit. |
| `helpers.php` | Shared functions the scripts above use. |
| `etc/php.ini` | Raises `memory_limit`. Drupal installs need more than PHP's 128M default. |

## Quick start

```bash
cd drupal
.devtools/assemble
.devtools/provision
.devtools/start
```

## Importing the documentation

`import` needs `node` and `git`, and the Node dependency installed at the
repository root:

```bash
npm ci
cd drupal
.devtools/import
```

The pin is `../docs-source.json`. See the repository README for how a bump
is made and reviewed.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEBSERVER_HOST` | `127.0.0.1` | PHP server bind host |
| `WEBSERVER_PORT` | auto-discovered (8888+) | PHP server port |
| `WEBSERVER_WAIT_TIMEOUT` | `20` | Seconds `start` waits for the server to answer |
| `DB_FILE` | `/tmp/cms-druxtjs-org-drupal.sqlite` | SQLite database path |
| `SITE_NAME` | `DruxtJS documentation` | Site name on a bare install |
| `XDEBUG` | unset | Set to any value to enable Xdebug |
| `DOCS_CHECKOUT` | unset | Build from this documentation checkout instead of the pinned commit. Refused with `--check`. |
| `DOCS_REPOSITORY` | the pin's `repository` | Fetch the same pinned commit from this URL instead. |
