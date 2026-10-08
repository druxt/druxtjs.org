<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\Core\Template\Attribute;
use Drupal\Core\Theme\ActiveTheme;
use Drupal\Core\Theme\ThemeManagerInterface;
use Drupal\druxtjsorg\Hook\AdminThemeHooks;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * The admin fixes attach to Gin, and to nothing else.
 */
#[CoversClass(AdminThemeHooks::class)]
#[Group('druxtjsorg')]
final class AdminThemeHooksTest extends UnitTestCase {

  /**
   * Gin gets the stylesheet and the attribute its selectors need.
   */
  public function testGinGetsTheStylesheetAndItsAttribute(): void {
    $hooks = new AdminThemeHooks($this->themeManager('gin'));

    $attachments = [];
    $hooks->pageAttachments($attachments);
    self::assertSame(['druxtjsorg/admin'], $attachments['#attached']['library']);

    $variables = ['html_attributes' => new Attribute()];
    $hooks->preprocessHtml($variables);
    self::assertTrue($variables['html_attributes']->hasAttribute(AdminThemeHooks::ATTRIBUTE));
  }

  /**
   * Another theme is left alone.
   */
  public function testAnotherThemeIsLeftAlone(): void {
    $hooks = new AdminThemeHooks($this->themeManager('druxtjs'));

    $attachments = [];
    $hooks->pageAttachments($attachments);
    self::assertSame([], $attachments);

    $variables = ['html_attributes' => new Attribute()];
    $hooks->preprocessHtml($variables);
    self::assertFalse($variables['html_attributes']->hasAttribute(AdminThemeHooks::ATTRIBUTE));
  }

  /**
   * A theme manager whose active theme has this name.
   */
  private function themeManager(string $name): ThemeManagerInterface {
    $theme = $this->createMock(ActiveTheme::class);
    $theme->method('getName')->willReturn($name);
    $manager = $this->createMock(ThemeManagerInterface::class);
    $manager->method('getActiveTheme')->willReturn($theme);
    return $manager;
  }

}
