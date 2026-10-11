<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Access;

use Drupal\Core\Access\AccessResult;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\jsonapi\Access\EntityAccessChecker;

/**
 * Reads a workspace's revision as the workspace's page, not as a revision.
 *
 * Inside a workspace the page an account reads is the workspace's revision,
 * which is not the default revision. JSON:API treats any non-default
 * revision as a revision view and asks for the revision permissions, which
 * a reviewer on a preview link does not have and should not need: to them
 * the workspace's revision is the page. When the active workspace holds the
 * revision being read, view access is the entity's own.
 */
final class WorkspaceEntityAccessChecker extends EntityAccessChecker {

  /**
   * {@inheritdoc}
   */
  protected function checkRevisionViewAccess(EntityInterface $entity, AccountInterface $account) {
    if ($this->isActiveWorkspaceRevision($entity)) {
      return AccessResult::allowed()->addCacheContexts(['workspace'])->addCacheableDependency($entity);
    }
    return parent::checkRevisionViewAccess($entity, $account);
  }

  /**
   * Whether the entity is the revision the active workspace tracks for it.
   */
  private function isActiveWorkspaceRevision(EntityInterface $entity): bool {
    if (!\Drupal::hasService('workspaces.manager') || !\Drupal::hasService('workspaces.association')) {
      return FALSE;
    }
    $manager = \Drupal::service('workspaces.manager');
    if (!$manager->hasActiveWorkspace()) {
      return FALSE;
    }
    $tracked = \Drupal::service('workspaces.association')->getAssociatedRevisions($manager->getActiveWorkspace()->id(), $entity->getEntityTypeId(), [$entity->id()]);
    return isset($tracked[$entity->getRevisionId()]);
  }

}
