<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Core\Hook\Attribute\Hook;
use Drupal\workspaces\WorkspaceInformationInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Makes a workspace-tracked entity's cacheability vary by workspace.
 *
 * JSON:API caches each normalization by type, id and language, varied only by
 * the entity's own cache contexts. Workspaces adds none to the entity, so a
 * normalization made in a workspace answered live reads, and the other way
 * round. A reader is always on live, so for them this varies by nothing.
 */
final class WorkspaceCacheHooks {

  public function __construct(
    // Looked up when used: an optional reference compiles to NULL here.
    #[Autowire(service: 'service_container')]
    private readonly ContainerInterface $container,
  ) {}

  /**
   * Implements hook_entity_load().
   */
  #[Hook('entity_load')]
  public function entityLoad(array $entities, string $entity_type_id): void {
    if (!$this->container->has('workspaces.information')) {
      return;
    }
    $information = $this->container->get('workspaces.information');
    assert($information instanceof WorkspaceInformationInterface);
    foreach ($entities as $entity) {
      if ($information->isEntitySupported($entity)) {
        $entity->addCacheContexts(['workspace']);
      }
    }
  }

}
