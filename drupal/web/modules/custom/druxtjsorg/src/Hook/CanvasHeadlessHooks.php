<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Core\Hook\Attribute\Hook;

/**
 * Lets a Canvas Headless preview read the workspace its editor is in.
 *
 * A preview's token holds only the permissions modules declare safe for it,
 * and none of Workspaces' are. The frontend names the editor's workspace on
 * the preview's requests, and without leave to view it they are answered from
 * live: a page that exists only in a workspace is then not found, and one
 * that is changed in it shows its live content.
 */
final class CanvasHeadlessHooks {

  /**
   * Implements hook_canvas_headless_safe_permissions().
   */
  #[Hook('canvas_headless_safe_permissions')]
  public function safePermissions(): array {
    // Viewing only. The token still holds no more than its editor does.
    return ['view own workspace', 'view any workspace'];
  }

}
