<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Controller;

use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\RevisionableInterface;
use Drupal\jsonapi\Controller\EntityResource;
use Drupal\jsonapi\ResourceType\ResourceType;
use Drupal\workspaces\WorkspaceInformationInterface;
use Drupal\workspaces\WorkspaceManagerInterface;
use Symfony\Component\HttpFoundation\Request;

/**
 * Lets JSON:API update an entity again inside the workspace that changed it.
 *
 * JSON:API refuses to update anything but a default revision (drupal.org
 * issue 2795279). In a workspace an entity, once changed, loads as that
 * workspace's pending revision, so every second write to it was refused.
 * Workspaces saves every update in a workspace as a pending revision, so
 * passing the check here cannot reach live.
 */
class WorkspaceEntityResource extends EntityResource {

  /**
   * {@inheritdoc}
   */
  public function patchIndividual(ResourceType $resource_type, EntityInterface $entity, Request $request) {
    if ($this->isActiveWorkspaceRevision($entity)) {
      assert($entity instanceof RevisionableInterface);
      $entity->isDefaultRevision(TRUE);
    }
    return parent::patchIndividual($resource_type, $entity, $request);
  }

  /**
   * Whether the entity is the active workspace's latest revision of itself.
   */
  protected function isActiveWorkspaceRevision(EntityInterface $entity): bool {
    // Looked up, not injected: jsonapi_node_preview's controller service
    // inherits this definition, and would inherit a setter call with it.
    $manager = \Drupal::service('workspaces.manager');
    assert($manager instanceof WorkspaceManagerInterface);
    $information = \Drupal::service('workspaces.information');
    assert($information instanceof WorkspaceInformationInterface);
    $workspace = $manager->getActiveWorkspace();
    if ($workspace === NULL
      || !$entity instanceof RevisionableInterface
      || !$information->isEntitySupported($entity)
      || $entity->isDefaultRevision()
      || !$entity->isLatestRevision()) {
      return FALSE;
    }
    $field = $entity->getEntityType()->getRevisionMetadataKey('workspace');
    return $entity->get($field)->target_id === $workspace->id();
  }

}
