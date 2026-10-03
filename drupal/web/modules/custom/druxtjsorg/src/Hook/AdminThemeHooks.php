<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Theme\ThemeManagerInterface;

/**
 * Small fixes to Gin, the admin theme, loaded only where it renders.
 */
final class AdminThemeHooks {

  public function __construct(private readonly ThemeManagerInterface $themeManager) {}

  /**
   * Implements hook_page_attachments().
   */
  #[Hook('page_attachments')]
  public function pageAttachments(array &$attachments): void {
    if ($this->themeManager->getActiveTheme()->getName() === 'gin') {
      $attachments['#attached']['library'][] = 'druxtjsorg/admin';
    }
  }

}
