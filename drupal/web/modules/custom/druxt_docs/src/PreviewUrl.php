<?php

declare(strict_types=1);

namespace Drupal\druxt_docs;

use Drupal\Component\Utility\UrlHelper;
use Drupal\Core\Site\Settings;

/**
 * The frontend's preview URL for an unsaved node.
 *
 * $settings['druxt_docs_preview_url'] is a URL template. {uuid} is the
 * node's UUID, which keys its preview in core's tempstore, and {view_mode}
 * is the view mode being previewed.
 */
final class PreviewUrl {

  /**
   * The frontend preview URL, or NULL when none is configured.
   */
  public static function frontend(string $uuid, string $view_mode): ?string {
    $template = trim((string) Settings::get('druxt_docs_preview_url', ''));
    if ($template === '') {
      return NULL;
    }
    return UrlHelper::stripDangerousProtocols(strtr($template, [
      '{uuid}' => rawurlencode($uuid),
      '{view_mode}' => rawurlencode($view_mode),
    ]));
  }

}
