<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Revisions;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Entity\RevisionableInterface;
use Drupal\workspaces\WorkspaceInformationInterface;
use Drupal\workspaces\WorkspaceManagerInterface;

/**
 * The working copy of an entity on live, leaving workspaces' revisions out.
 *
 * Core's latest revision on live is the newest of all, so a revision saved in
 * a workspace became live's draft: an editor reading live saw staged content.
 * Inside a workspace core already answers with that workspace's revision.
 */
final class LiveWorkingCopy {

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly WorkspaceManagerInterface $workspaceManager,
    private readonly WorkspaceInformationInterface $workspaceInformation,
  ) {}

  /**
   * The working copy's revision id, or NULL to leave it to core.
   */
  public function revisionId(RevisionableInterface $entity): ?int {
    if ($this->workspaceManager->hasActiveWorkspace() || !$this->workspaceInformation->isEntitySupported($entity)) {
      return NULL;
    }
    $type = $entity->getEntityType();
    $storage = $this->entityTypeManager->getStorage($type->id());
    $query = $storage->getQuery()->allRevisions()->accessCheck(FALSE);
    $off_workspace = $query->orConditionGroup()
      ->notExists($type->getRevisionMetadataKey('workspace'))
      ->condition($type->getRevisionMetadataKey('revision_default'), TRUE);
    $ids = $query
      ->condition($type->getKey('id'), $entity->id())
      ->condition($off_workspace)
      ->sort($type->getKey('revision'), 'DESC')
      ->range(0, 1)
      ->execute();
    return $ids ? (int) array_key_first($ids) : NULL;
  }

}
