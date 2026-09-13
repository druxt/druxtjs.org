<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\druxt_docs\Routing\PreviewRouteSubscriber;
use Drupal\KernelTests\KernelTestBase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Which theme core's node preview renders in, on a built router.
 */
#[CoversClass(PreviewRouteSubscriber::class)]
#[Group('druxt_docs')]
#[RunTestsInSeparateProcesses]
final class PreviewRouteTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = ['system', 'user', 'node', 'path_alias', 'druxt_docs'];

  /**
   * With nodes edited in the admin theme, the preview is there too.
   */
  public function testThePreviewUsesTheAdminThemeWhenNodesDo(): void {
    self::assertTrue($this->previewIsAdminRoute(TRUE));
  }

  /**
   * With nodes edited in the front theme, the preview stays there.
   */
  public function testThePreviewStaysInTheFrontThemeWhenNodesDo(): void {
    self::assertFalse($this->previewIsAdminRoute(FALSE));
  }

  /**
   * Whether the built preview route is an admin route under the setting.
   */
  private function previewIsAdminRoute(bool $use_admin_theme): bool {
    $this->config('node.settings')->set('use_admin_theme', $use_admin_theme)->save();
    $this->container->get('router.builder')->rebuild();
    $route = $this->container->get('router.route_provider')->getRouteByName('entity.node.preview');
    return $this->container->get('router.admin_context')->isAdminRoute($route);
  }

}
