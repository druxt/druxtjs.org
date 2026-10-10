<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Core\Hook\Attribute\Hook;
use Drupal\workspaces\Entity\Handler\DefaultWorkspaceHandler;

/**
 * Keeps paragraphs tracked by Workspaces.
 *
 * Workspaces Extra marks the paragraph entity type ignored, so a paragraph
 * saved in a workspace is saved to live and only its host's workspace
 * revision points at it. This site tracks paragraphs, as core does without
 * that module: a workspace deploy exports tracked entities alone, so an
 * untracked paragraph never reaches the target and the page that references
 * it cannot be imported there.
 */
class WorkspaceEntityTypeHooks {

  /**
   * Implements hook_entity_type_alter().
   */
  #[Hook('entity_type_alter')]
  public function entityTypeAlter(array &$entity_types): void {
    // After Workspaces Extra's build hook, which sets the ignored handler.
    // Its alter hook gives every supported type a constraint against edits
    // in a closed workspace; whichever of the two alters runs first, a
    // paragraph gets that constraint too.
    if (isset($entity_types['paragraph'])) {
      $entity_types['paragraph']->setHandlerClass('workspace', DefaultWorkspaceHandler::class);
      if (!isset($entity_types['paragraph']->getConstraints()['WseClosedWorkspace'])) {
        $entity_types['paragraph']->addConstraint('WseClosedWorkspace');
      }
    }
  }

}
