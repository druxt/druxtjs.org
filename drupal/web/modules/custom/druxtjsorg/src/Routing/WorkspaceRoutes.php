<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Routing;

use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Extension\ModuleHandlerInterface;
use Drupal\druxtjsorg\Controller\WorkspaceChangesController;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;

/**
 * The workspace routes, only where Workspaces is installed.
 *
 * A static route naming the workspace entity type would break the router on
 * a site without the module, the way the module's services are only
 * registered with it.
 */
final class WorkspaceRoutes implements ContainerInjectionInterface {

  public function __construct(
    private readonly ModuleHandlerInterface $moduleHandler,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): self {
    return new self($container->get('module_handler'));
  }

  /**
   * The routes.
   */
  public function routes(): RouteCollection {
    $routes = new RouteCollection();
    if (!$this->moduleHandler->moduleExists('workspaces')) {
      return $routes;
    }
    $routes->add('druxtjsorg.workspace_created', new Route(
      '/druxt-docs/workspace/{workspace}/created',
      ['_controller' => WorkspaceChangesController::class . '::created'],
      ['_entity_access' => 'workspace.view'],
      [
        'parameters' => ['workspace' => ['type' => 'entity:workspace']],
        '_auth' => ['oauth2', 'cookie'],
        'no_cache' => TRUE,
      ],
      '',
      [],
      ['GET'],
    ));
    return $routes;
  }

}
