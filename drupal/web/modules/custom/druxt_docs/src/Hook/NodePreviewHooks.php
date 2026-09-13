<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Hook;

use Drupal\Core\Hook\Attribute\Hook;

/**
 * Registers the tabbed node preview's template.
 */
final class NodePreviewHooks {

  /**
   * Implements hook_theme().
   */
  #[Hook('theme')]
  public function theme(): array {
    return [
      'druxt_docs_node_preview' => [
        'variables' => [
          'drupal' => [],
          'frontend_url' => NULL,
          'jsonapi_url' => NULL,
        ],
      ],
    ];
  }

}
