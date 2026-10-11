<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Entity\FieldableEntityInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\TypedData\TranslatableInterface;
use Drupal\entity_reference_revisions\Plugin\Field\FieldType\EntityReferenceRevisionsItem;

/**
 * Keeps an entity reference revisions item on a revision of its own target.
 *
 * Workspaces Deploy keeps an entity's id across sites but gives each saved
 * revision a new revision id, and a deployed node still names its
 * paragraphs by the revision ids of the site it came from. On the target
 * those ids belong to other paragraphs, or to none. An item whose revision
 * is not a revision of its target takes the target's current revision.
 */
final class ReferenceRevisionHooks {

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
  ) {}

  /**
   * Re-points stray revision references before the entity is saved.
   */
  #[Hook('entity_presave')]
  public function entityPresave(EntityInterface $entity): void {
    if (!$entity instanceof FieldableEntityInterface) {
      return;
    }
    $translations = $entity instanceof TranslatableInterface
      ? array_map(fn(string $langcode) => $entity->getTranslation($langcode), array_keys($entity->getTranslationLanguages()))
      : [$entity];
    foreach ($translations as $translation) {
      $this->repointFields($translation);
    }
  }

  /**
   * Re-points the stray references of one translation.
   */
  private function repointFields(FieldableEntityInterface $entity): void {
    foreach ($entity->getFields(FALSE) as $field) {
      if ($field->getFieldDefinition()->getType() !== 'entity_reference_revisions') {
        continue;
      }
      $storage = NULL;
      foreach ($field as $item) {
        if (!$item instanceof EntityReferenceRevisionsItem || $item->isEmpty() || !$item->target_id) {
          continue;
        }
        $storage ??= $this->entityTypeManager->getStorage($field->getFieldDefinition()->getSetting('target_type'));
        $revision = $item->target_revision_id ? $storage->loadRevision($item->target_revision_id) : NULL;
        if ($revision && (string) $revision->id() === (string) $item->target_id) {
          continue;
        }
        $target = $storage->load($item->target_id);
        if ($target) {
          $item->setValue(['target_id' => $target->id(), 'target_revision_id' => $target->getRevisionId()]);
        }
      }
    }
  }

}
