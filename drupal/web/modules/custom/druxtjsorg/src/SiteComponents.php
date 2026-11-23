<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

/**
 * Moves a Canvas page from Drupal's components to the site's own.
 *
 * Each of this module's components has a twin the site declares to Canvas,
 * with the same name, props and slots. Canvas's editor previews through the
 * site, and only the site's components are drawn there as the site draws
 * them, so a page built from Drupal's is moved to its twins.
 */
final class SiteComponents {

  /**
   * How Canvas names one of this module's components.
   */
  private const DRUPAL = 'sdc.druxtjsorg.';

  /**
   * How Canvas names one of the site's.
   */
  private const SITE = 'js.';

  /**
   * Returns the site's twin of a component, or NULL when it is not Drupal's.
   */
  public static function twin(string $component_id): ?string {
    return str_starts_with($component_id, self::DRUPAL)
      ? self::SITE . substr($component_id, strlen(self::DRUPAL))
      : NULL;
  }

  /**
   * Moves a page's component items to the site's components.
   *
   * An item moves only when its twin is at the version the item was saved
   * with: the two then take the same inputs, which are left as they are.
   *
   * @param array<int, array<string, mixed>> $items
   *   The page's component items.
   * @param array<string, string> $versions
   *   The active version of each of the site's components, by its ID.
   *
   * @return array{0: array<int, array<string, mixed>>, 1: int, 2: string[]}
   *   The items, how many moved, and the components left for want of a twin
   *   at their version.
   */
  public static function move(array $items, array $versions): array {
    $moved = 0;
    $left = [];
    foreach ($items as &$item) {
      $twin = self::twin((string) ($item['component_id'] ?? ''));
      if ($twin === NULL) {
        continue;
      }
      if (($versions[$twin] ?? NULL) !== ($item['component_version'] ?? NULL)) {
        $left[] = $item['component_id'];
        continue;
      }
      $item['component_id'] = $twin;
      $moved++;
    }
    unset($item);
    return [$items, $moved, array_values(array_unique($left))];
  }

}
