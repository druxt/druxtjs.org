<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Hook;

use Drupal\Component\Utility\Html;
use Drupal\Core\Hook\Attribute\Hook;

/**
 * Styles block previews in the layout builder like the frontend.
 */
final class DruxtDocsThemeHooks {

  /**
   * Implements hook_preprocess_HOOK() for paragraph templates.
   *
   * Only the preview view mode is styled; the default display, which Druxt
   * reads to render the API's data, stays plain.
   */
  #[Hook('preprocess_paragraph')]
  public function preprocessParagraph(array &$variables): void {
    if (($variables['view_mode'] ?? '') !== 'preview') {
      return;
    }
    $variables['attributes']['class'][] = 'prose';
    $paragraph = $variables['paragraph'];
    if ($paragraph->bundle() === 'docs_callout' && !$paragraph->get('field_callout_type')->isEmpty()) {
      $variables['attributes']['class'][] = 'docs-callout';
      $variables['attributes']['class'][] = 'docs-callout--' . Html::getClass($paragraph->get('field_callout_type')->value);
    }
    $variables['#attached']['library'][] = 'druxt_docs/preview';
  }

}
