<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Theme\ThemeManagerInterface;

/**
 * Small fixes to Gin, the admin theme, loaded only where it renders.
 *
 * The stylesheet's rules lift their specificity through the
 * `data-drupal-admin-styles` attribute, which Gin itself never sets, so this
 * puts it on the document wherever the stylesheet is attached.
 */
final class AdminThemeHooks {

  /**
   * The attribute the admin stylesheet's selectors hang off.
   */
  public const ATTRIBUTE = 'data-drupal-admin-styles';

  public function __construct(private readonly ThemeManagerInterface $themeManager) {}

  /**
   * Implements hook_page_attachments().
   */
  #[Hook('page_attachments')]
  public function pageAttachments(array &$attachments): void {
    if ($this->isGin()) {
      $attachments['#attached']['library'][] = 'druxtjsorg/admin';
    }
  }

  /**
   * Implements hook_preprocess_html().
   */
  #[Hook('preprocess_html')]
  public function preprocessHtml(array &$variables): void {
    if ($this->isGin()) {
      $variables['html_attributes']->setAttribute(self::ATTRIBUTE, '');
    }
  }

  /**
   * Whether Gin renders this page.
   */
  private function isGin(): bool {
    return $this->themeManager->getActiveTheme()->getName() === 'gin';
  }

}
