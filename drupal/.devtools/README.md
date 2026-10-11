Local development without Docker. Just PHP, Composer, and SQLite.

## Scripts

| Script | What it does |
| --- | --- |
| `assemble` | Install Composer dependencies. |
| `provision` | Install Drupal fresh from the committed configuration, with no content. |
| `start` | Start the PHP dev server. Write `BASE_URL` to `../.env`. |
| `stop` | Stop the dev server. |
| `info` | Show the current environment: PHP, Drupal, Composer, and Drush versions, webserver, database. |
| `helpers.php` | Shared functions the scripts above use. |
| `etc/php.ini` | Raises `memory_limit`. Drupal installs need more than PHP's 128M default. |

## Quick start

```bash
cd drupal
.devtools/assemble
.devtools/provision
.devtools/start
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEBSERVER_HOST` | `127.0.0.1` | PHP server bind host |
| `WEBSERVER_PORT` | auto-discovered (8888+) | PHP server port |
| `WEBSERVER_WAIT_TIMEOUT` | `20` | Seconds `start` waits for the server to answer |
| `DB_FILE` | `/tmp/cms-druxtjs-org-drupal.sqlite` | SQLite database path |
| `SITE_NAME` | `DruxtJS documentation` | Site name on a bare install |
| `XDEBUG` | unset | Set to any value to enable Xdebug |
