<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Routing;

use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Extension\ModuleHandlerInterface;
use Drupal\druxtjsorg\Controller\PreviewDiffResource;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;

/**
 * The preview diff route, only where jsonapi_diff is installed.
 *
 * The resource is built on jsonapi_diff's services, which a site without the
 * module does not have.
 */
final class PreviewDiffRoutes implements ContainerInjectionInterface {

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
    if (!$this->moduleHandler->moduleExists('jsonapi_diff')) {
      return $routes;
    }
    $routes->add('druxtjsorg.preview_diff', new Route(
      '/%jsonapi%/diff-preview/{entity_type}/{bundle}/{uuid}',
      ['_jsonapi_resource' => PreviewDiffResource::class],
      // The resource checks access itself: the left side as jsonapi_diff
      // does, the right side as the editor's own preview.
      ['_access' => 'TRUE'],
      [],
      '',
      [],
      ['GET'],
    ));
    return $routes;
  }

}
