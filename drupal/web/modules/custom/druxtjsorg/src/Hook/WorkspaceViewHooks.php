<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Core\Entity\Display\EntityViewDisplayInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\StringTranslation\StringTranslationTrait;

/**
 * Lists a workspace's changes by page, and fits the list to a phone.
 *
 * Core lists every tracked entity, so a page edited once arrives with a row
 * for each of its paragraphs, labelled as a previous revision, and the pages
 * are buried among them. A paragraph is part of its page, and opening the
 * page shows it, so only entities that stand on their own are listed.
 */
final class WorkspaceViewHooks {

  use StringTranslationTrait;

  /**
   * Core's responsive table priorities: RESPONSIVE_PRIORITY_LOW and _MEDIUM.
   */
  public const PRIORITY_LOW = 'priority-low';
  public const PRIORITY_MEDIUM = 'priority-medium';

  /**
   * Implements hook_ENTITY_TYPE_view_alter() for workspace.
   */
  #[Hook('workspace_view_alter')]
  public function workspaceViewAlter(array &$build, EntityInterface $entity, EntityViewDisplayInterface $display): void {
    if (!isset($build['changes']['list']['#header'])) {
      return;
    }
    $list = &$build['changes']['list'];

    foreach ($list as $key => $row) {
      if (is_array($row) && ($row['#entity'] ?? NULL) instanceof EntityInterface && self::isPart($row['#entity'])) {
        unset($list[$key]);
      }
    }

    // The title and its operations are what a phone has room for.
    foreach (['type' => self::PRIORITY_LOW, 'owner' => self::PRIORITY_LOW, 'changed' => self::PRIORITY_MEDIUM] as $column => $priority) {
      if (isset($list['#header'][$column])) {
        $list['#header'][$column] = ['data' => $list['#header'][$column], 'class' => [$priority]];
      }
    }

    $build['changes']['overview']['#description'] = $this->t('Paragraphs are counted, and listed with the page they belong to.');
    // Outside a form an item prints no description unless told where.
    $build['changes']['overview']['#description_display'] = 'after';
  }

  /**
   * Whether an entity exists only as part of another, the way a paragraph does.
   */
  private static function isPart(EntityInterface $entity): bool {
    return (bool) $entity->getEntityType()->get('entity_revision_parent_id_field');
  }

}
