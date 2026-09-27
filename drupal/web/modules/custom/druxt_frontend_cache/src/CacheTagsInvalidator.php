<?php

declare(strict_types=1);

namespace Drupal\druxt_frontend_cache;

use Drupal\Core\Cache\CacheTagsInvalidatorInterface;

/**
 * Marks the frontend's cache stale whenever this site invalidates a cache tag.
 *
 * Every content, menu and configuration save invalidates tags, so this catches
 * all of them. The frontend's cache holds only the JSON:API index and the
 * menus, so a clear costs it a handful of requests; being selective about
 * which tags matter would save little and could miss one.
 */
final class CacheTagsInvalidator implements CacheTagsInvalidatorInterface {

  public function __construct(
    private readonly Notifier $notifier,
  ) {}

  /**
   * {@inheritdoc}
   */
  public function invalidateTags(array $tags): void {
    if ($tags !== []) {
      $this->notifier->markDirty();
    }
  }

}
