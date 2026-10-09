<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\Core\Routing\RouteMatchInterface;
use Drupal\druxtjsorg\Hook\PreviewFrameHooks;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * The preview frame library goes on the preview tab's route alone.
 */
#[CoversClass(PreviewFrameHooks::class)]
#[Group('druxtjsorg')]
final class PreviewFrameHooksTest extends UnitTestCase {

  /**
   * The JSON:API preview tab gets the library.
   */
  public function testThePreviewTabGetsTheLibrary(): void {
    $hooks = new PreviewFrameHooks($this->routeMatch('entity.node.json_preview'));
    $attachments = [];
    $hooks->pageAttachments($attachments);
    self::assertSame(['druxtjsorg/preview-frame'], $attachments['#attached']['library']);
  }

  /**
   * Any other route, the edit form included, is left alone.
   */
  public function testOtherRoutesAreLeftAlone(): void {
    foreach (['entity.node.edit_form', 'entity.node.canonical', NULL] as $route) {
      $hooks = new PreviewFrameHooks($this->routeMatch($route));
      $attachments = [];
      $hooks->pageAttachments($attachments);
      self::assertSame([], $attachments, (string) $route);
    }
  }

  /**
   * A route match answering the given route name.
   */
  private function routeMatch(?string $name): RouteMatchInterface {
    $match = $this->createMock(RouteMatchInterface::class);
    $match->method('getRouteName')->willReturn($name);
    return $match;
  }

}
