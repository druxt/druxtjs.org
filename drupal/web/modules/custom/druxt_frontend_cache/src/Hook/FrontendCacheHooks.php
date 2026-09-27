<?php

declare(strict_types=1);

namespace Drupal\druxt_frontend_cache\Hook;

use Drupal\Core\Extension\Requirement\RequirementSeverity;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\StringTranslation\StringTranslationTrait;
use Drupal\druxt_frontend_cache\Notifier;

/**
 * A full cache flush clears the frontend too, and the status report says whether it can.
 */
final class FrontendCacheHooks {

  use StringTranslationTrait;

  public function __construct(
    private readonly Notifier $notifier,
  ) {}

  /**
   * Implements hook_cache_flush().
   *
   * `drush cache:rebuild` and the "Clear all caches" button empty the bins
   * directly rather than invalidating tags, so the invalidator never sees them.
   */
  #[Hook('cache_flush')]
  public function cacheFlush(): void {
    $this->notifier->markDirty();
  }

  /**
   * Implements hook_runtime_requirements().
   */
  #[Hook('runtime_requirements')]
  public function runtimeRequirements(): array {
    $urls = $this->notifier->urls();
    $configured = $this->notifier->isConfigured();
    return [
      'druxt_frontend_cache' => [
        'title' => $this->t('Druxt frontend cache'),
        'value' => $configured
          ? $this->t('Clears @urls when content changes.', ['@urls' => implode(', ', $urls)])
          : $this->t('Not configured.'),
        'description' => $configured
          ? NULL
          : $this->t('Set DRUXT_CACHE_SECRET, the same value the Nuxt server has as druxt.cache.secret, and a frontend URL. Until then a change here waits out the page cache max_age before readers see it.'),
        'severity' => $configured ? RequirementSeverity::OK : RequirementSeverity::Warning,
      ],
    ];
  }

}
