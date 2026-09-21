<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Hook;

use Drupal\Core\Hook\Attribute\Hook;

/**
 * Exposes the configuration the frontend's editing widgets read.
 */
final class DruxtResourcesHooks {

  /**
   * The editors and text formats a text field's widget is built from.
   */
  private const RESOURCES = [
    'editor--editor',
    'filter_format--filter_format',
  ];

  /**
   * Implements hook_druxt_resources_alter().
   *
   * In code rather than in druxt.settings, so the site's list stays Druxt's
   * default and the reason for each addition is kept with the module that
   * needs it.
   */
  #[Hook('druxt_resources_alter')]
  public function druxtResourcesAlter(array &$resources): void {
    foreach (self::RESOURCES as $resource) {
      if (!in_array($resource, $resources, TRUE)) {
        $resources[] = $resource;
      }
    }
  }

}
