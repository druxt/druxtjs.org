<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Routing\RouteMatchInterface;

/**
 * Fits the JSON:API preview tab's iframe to the viewport.
 *
 * The tab module (jsonapi_node_preview_tab) renders a fixed-height iframe
 * in the page. On its route the preview-frame library pins the iframe to the
 * viewport inside the toolbar's edges, so the preview fills the screen.
 */
final class PreviewFrameHooks {

  /**
   * The routes whose iframe fills the viewport.
   */
  public const ROUTES = ['entity.node.json_preview'];

  public function __construct(
    private readonly RouteMatchInterface $routeMatch,
  ) {}

  /**
   * Attaches the library on a preview route.
   */
  #[Hook('page_attachments')]
  public function pageAttachments(array &$attachments): void {
    if (in_array($this->routeMatch->getRouteName(), self::ROUTES, TRUE)) {
      $attachments['#attached']['library'][] = 'druxtjsorg/preview-frame';
    }
  }

}
