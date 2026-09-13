<?php

/**
 * @file
 * Settings for the site on Lagoon.
 *
 * The cli image writes settings.php from core's default and includes this
 * file from it. Everything here comes from the environment Lagoon gives each
 * container, so one image serves every environment.
 */

$databases['default']['default'] = [
  'driver' => 'mysql',
  'database' => getenv('MARIADB_DATABASE') ?: 'drupal',
  'username' => getenv('MARIADB_USERNAME') ?: 'drupal',
  'password' => getenv('MARIADB_PASSWORD') ?: 'drupal',
  'host' => getenv('MARIADB_HOST') ?: 'mariadb',
  'port' => getenv('MARIADB_PORT') ?: '3306',
  'charset' => 'utf8mb4',
  'collation' => 'utf8mb4_general_ci',
  'prefix' => '',
];

// Secret per environment: the database password never leaves the platform.
$settings['hash_salt'] = getenv('DRUPAL_HASH_SALT') ?: hash('sha256', getenv('LAGOON_PROJECT') . ':' . getenv('LAGOON_ENVIRONMENT') . ':' . getenv('MARIADB_PASSWORD'));

$settings['config_sync_directory'] = '../config/sync';
$settings['file_private_path'] = 'sites/default/files/private';
$settings['file_temp_path'] = '/tmp';
$settings['skip_permissions_hardening'] = TRUE;

// Simple OAuth's keys live on the files volume, which nginx never serves under private/.
$config['simple_oauth.settings']['public_key'] = $app_root . '/' . $site_path . '/files/private/oauth/public.key';
$config['simple_oauth.settings']['private_key'] = $app_root . '/' . $site_path . '/files/private/oauth/private.key';

// Requests arrive through Lagoon's router, or through the Nuxt server's proxy.
$settings['reverse_proxy'] = TRUE;
$settings['reverse_proxy_addresses'] = [$_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'];

// This environment's routes, and the service name the Nuxt server calls Drupal by.
$routes = array_filter(array_map('trim', explode(',', (string) getenv('LAGOON_ROUTES'))));
$hosts = array_merge(['nginx', 'localhost'], array_map(static fn (string $route): string => (string) parse_url($route, PHP_URL_HOST), $routes));
$settings['trusted_host_patterns'] = array_values(array_map(static fn (string $host): string => '^' . preg_quote($host) . '$', array_unique(array_filter($hosts))));

// Anonymous visitors go to the frontend: DRUXT_FRONTEND_URL, else the nuxt service's route.
$frontend = getenv('DRUXT_FRONTEND_URL') ?: current(array_filter($routes, static fn (string $route): bool => str_starts_with((string) parse_url($route, PHP_URL_HOST), 'nuxt.')));
if ($frontend) {
  $settings['druxt_docs_frontend_url'] = rtrim($frontend, '/');
}

$environment_type = getenv('LAGOON_ENVIRONMENT_TYPE') ?: 'development';
$config['environment_indicator.indicator'] = [
  'name' => $environment_type === 'production' ? 'Production' : ucfirst($environment_type) . ': ' . getenv('LAGOON_ENVIRONMENT'),
  'fg_color' => '#ffffff',
  'bg_color' => $environment_type === 'production' ? '#b3261e' : '#1d4ed8',
];
