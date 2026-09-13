<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\Core\Routing\RouteBuildEvent;
use Drupal\druxt_docs\Controller\NodePreviewController;
use Drupal\druxt_docs\Routing\PreviewRouteSubscriber;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;

/**
 * How core's node preview route is altered.
 */
#[CoversClass(PreviewRouteSubscriber::class)]
#[Group('druxt_docs')]
final class PreviewRouteSubscriberTest extends UnitTestCase {

  /**
   * The preview is a node operation, so it follows the admin theme setting.
   */
  public function testThePreviewIsANodeOperation(): void {
    self::assertTrue($this->alter()->get('entity.node.preview')->getOption('_node_operation_route'));
  }

  /**
   * The preview renders through the tabbed controller.
   */
  public function testThePreviewRendersAsTabs(): void {
    self::assertSame(NodePreviewController::class . '::view', $this->alter()->get('entity.node.preview')->getDefault('_controller'));
  }

  /**
   * Core's access check, tempstore converter and no-cache flag stay.
   */
  public function testThePreviewKeepsCoresAccessAndTempstore(): void {
    $route = $this->alter()->get('entity.node.preview');
    self::assertSame('{node_preview}', $route->getRequirement('_node_preview_access'));
    self::assertSame(['node_preview' => ['type' => 'node_preview']], $route->getOption('parameters'));
    self::assertTrue($route->getOption('no_cache'));
  }

  /**
   * Other node routes are left alone.
   */
  public function testOtherRoutesAreLeftAlone(): void {
    self::assertFalse($this->alter()->get('entity.node.canonical')->hasOption('_node_operation_route'));
  }

  /**
   * A router without the preview route is left as it is.
   */
  public function testARouterWithoutThePreviewIsLeftAlone(): void {
    $collection = new RouteCollection();
    (new PreviewRouteSubscriber())->onAlterRoutes(new RouteBuildEvent($collection));
    self::assertCount(0, $collection);
  }

  /**
   * Core's preview route and a neighbour, after the subscriber has run.
   */
  private function alter(): RouteCollection {
    $collection = new RouteCollection();
    $collection->add('entity.node.preview', new Route(
      '/node/preview/{node_preview}/{view_mode_id}',
      ['_controller' => '\Drupal\node\Controller\NodePreviewController::view'],
      ['_node_preview_access' => '{node_preview}'],
      ['no_cache' => TRUE, 'parameters' => ['node_preview' => ['type' => 'node_preview']]],
    ));
    $collection->add('entity.node.canonical', new Route('/node/{node}'));
    (new PreviewRouteSubscriber())->onAlterRoutes(new RouteBuildEvent($collection));
    return $collection;
  }

}
