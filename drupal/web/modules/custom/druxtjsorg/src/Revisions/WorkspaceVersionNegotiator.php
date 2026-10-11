<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Revisions;

use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\RevisionableInterface;
use Drupal\jsonapi\Revisions\VersionNegotiator;

/**
 * `rel:working-copy` that, on live, is never a workspace's revision.
 *
 * JSON:API accepts no negotiator outside its own namespace, so this is the
 * dispatcher, answering a live working copy with that revision by id.
 */
class WorkspaceVersionNegotiator extends VersionNegotiator {

  /**
   * {@inheritdoc}
   */
  public function getRevision(EntityInterface $entity, $resource_version_identifier) {
    if ($resource_version_identifier === 'rel:working-copy' && $entity instanceof RevisionableInterface) {
      // Looked up when used, like the controller beside it.
      $live = \Drupal::service('druxtjsorg.live_working_copy')->revisionId($entity);
      if ($live !== NULL) {
        return parent::getRevision($entity, 'id:' . $live);
      }
    }
    return parent::getRevision($entity, $resource_version_identifier);
  }

}
