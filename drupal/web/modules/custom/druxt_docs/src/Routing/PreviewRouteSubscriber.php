<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Routing;

use Drupal\Core\Routing\RouteSubscriberBase;
use Drupal\Core\Routing\RoutingEvents;
use Drupal\druxt_docs\Controller\NodePreviewController;
use Symfony\Component\Routing\RouteCollection;

/**
 * Serves core's node preview in the admin theme, as tabs.
 *
 * The preview becomes a node operation like edit, so the node module's
 * "use the administration theme" setting decides its theme. Its controller
 * puts core's render in a tab beside the frontend and JSON:API previews.
 */
final class PreviewRouteSubscriber extends RouteSubscriberBase {

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    // Ahead of core's NodeAdminRouteSubscriber, which reads the option at 0.
    return [RoutingEvents::ALTER => ['onAlterRoutes', 10]];
  }

  /**
   * {@inheritdoc}
   */
  protected function alterRoutes(RouteCollection $collection): void {
    $route = $collection->get('entity.node.preview');
    if ($route === NULL) {
      return;
    }
    $route->setOption('_node_operation_route', TRUE);
    $route->setDefault('_controller', NodePreviewController::class . '::view');
  }

}
