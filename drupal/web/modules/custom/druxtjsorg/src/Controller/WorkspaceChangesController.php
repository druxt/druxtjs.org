<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Controller;

use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\workspaces\WorkspaceInterface;
use Drupal\workspaces\WorkspaceTrackerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * What a workspace has changed, beyond what JSON:API can say.
 *
 * JSON:API lists the pages a workspace changed, but cannot tell a page the
 * workspace created from one it edited: both read as published there, and
 * the request cannot ask live for the same pages while a workspace is
 * active. The workspace tracker records which entities were created in it.
 */
final class WorkspaceChangesController implements ContainerInjectionInterface {

  public function __construct(
    private readonly WorkspaceTrackerInterface $tracker,
    private readonly EntityTypeManagerInterface $entityTypeManager,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): self {
    return new self(
      $container->get('workspaces.tracker'),
      $container->get('entity_type.manager'),
    );
  }

  /**
   * The uuids of the nodes a workspace created, rather than edited.
   */
  public function created(WorkspaceInterface $workspace): JsonResponse {
    $ids = array_values(array_unique($this->tracker->getTrackedInitialRevisions($workspace->id(), 'node')));
    $uuids = [];
    if ($ids) {
      $uuids = array_values(array_map(
        static fn ($node) => $node->uuid(),
        $this->entityTypeManager->getStorage('node')->loadMultiple($ids),
      ));
    }
    // The list follows the workspace: an edit or a publish changes it.
    return (new JsonResponse(['data' => $uuids]))->setPrivate()->setMaxAge(0);
  }

}
