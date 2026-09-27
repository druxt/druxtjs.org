<?php

declare(strict_types=1);

namespace Drupal\druxt_frontend_cache;

use Drupal\Core\Site\Settings;
use GuzzleHttp\ClientInterface;
use Psr\Log\LoggerInterface;

/**
 * Sends the Nuxt server one cache clear per request, however much changed.
 *
 * Druxt holds the JSON:API index and the menus between server renders, for as
 * long as this site's page max_age allows. Without this, a change here waits
 * out that lifetime before readers see it. With it, the change shows on the
 * next render.
 *
 * Every Nuxt process keeps its own cache, so every process must be told:
 * `url` may name several, separated by commas.
 *
 * Configured from settings.php or the environment:
 *
 * @code
 * $settings['druxt_frontend_cache'] = [
 *   'url' => 'http://nuxt:3000',          // else $settings['druxt_docs_frontend_url']
 *   'secret' => getenv('DRUXT_CACHE_SECRET'),
 * ];
 * @endcode
 */
final class Notifier {

  /**
   * The endpoint Druxt's Nuxt module registers when `druxt.cache.secret` is set.
   */
  public const ENDPOINT = '/_druxt/cache/clear';

  /**
   * Whether something changed since the last clear was sent.
   */
  private bool $pending = FALSE;

  /**
   * Whether the CLI shutdown flush has been registered.
   */
  private bool $shutdownRegistered = FALSE;

  public function __construct(
    private readonly ClientInterface $httpClient,
    private readonly Settings $settings,
    private readonly LoggerInterface $logger,
  ) {}

  /**
   * Records that the frontend's cache is stale.
   *
   * A web request sends the clear once the response has gone out. Drush has no
   * such moment, so there the clear is sent when the process ends.
   */
  public function markDirty(): void {
    $this->pending = TRUE;
    if (PHP_SAPI === 'cli' && !$this->shutdownRegistered) {
      $this->shutdownRegistered = TRUE;
      register_shutdown_function([$this, 'flush']);
    }
  }

  /**
   * The frontend URLs to clear, without a trailing slash.
   *
   * @return string[]
   */
  public function urls(): array {
    $configured = $this->settings->get('druxt_frontend_cache')['url'] ?? $this->settings->get('druxt_docs_frontend_url') ?? '';
    return array_values(array_filter(array_map(
      static fn (string $url): string => rtrim(trim($url), '/'),
      explode(',', (string) $configured),
    )));
  }

  /**
   * The shared secret, or an empty string when the clear is not configured.
   */
  public function secret(): string {
    return (string) ($this->settings->get('druxt_frontend_cache')['secret'] ?? getenv('DRUXT_CACHE_SECRET') ?: '');
  }

  /**
   * Whether a clear can be sent at all.
   */
  public function isConfigured(): bool {
    return $this->urls() !== [] && $this->secret() !== '';
  }

  /**
   * Sends the clear, if anything changed and the frontend is configured.
   *
   * @return bool
   *   TRUE when every configured frontend answered 204.
   */
  public function flush(): bool {
    if (!$this->pending) {
      return TRUE;
    }
    $this->pending = FALSE;
    if (!$this->isConfigured()) {
      return FALSE;
    }

    $ok = TRUE;
    foreach ($this->urls() as $url) {
      try {
        $response = $this->httpClient->request('POST', $url . self::ENDPOINT, [
          'headers' => ['X-Druxt-Secret' => $this->secret()],
          'timeout' => 3,
          'http_errors' => FALSE,
        ]);
        $status = $response->getStatusCode();
        if ($status !== 204) {
          $ok = FALSE;
          $this->logger->warning('The frontend at @url answered @status to a cache clear. 401 means the secrets differ; 404 means druxt.cache.secret is not set in nuxt.config.js.', [
            '@url' => $url,
            '@status' => $status,
          ]);
        }
      }
      catch (\Throwable $e) {
        $ok = FALSE;
        $this->logger->error('Could not reach the frontend at @url to clear its cache: @message', [
          '@url' => $url,
          '@message' => $e->getMessage(),
        ]);
      }
    }
    return $ok;
  }

}
