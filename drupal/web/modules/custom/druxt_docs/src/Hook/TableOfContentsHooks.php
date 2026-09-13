<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Hook;

use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\Field\FieldStorageDefinitionInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\druxt_docs\Plugin\Field\TableOfContentsItemList;

/**
 * Gives documentation pages a table of contents computed from their content.
 */
final class TableOfContentsHooks {

  /**
   * Implements hook_entity_bundle_field_info().
   *
   * Computed, so it has no storage, no widget and nothing to import: it is
   * whatever the page's headings say when it is read.
   */
  #[Hook('entity_bundle_field_info')]
  public function entityBundleFieldInfo(EntityTypeInterface $entity_type, string $bundle): array {
    if ($entity_type->id() !== 'node' || $bundle !== 'doc_page') {
      return [];
    }
    return [
      'field_toc' => BaseFieldDefinition::create('docs_toc_entry')
        ->setLabel(new TranslatableMarkup('Table of contents'))
        ->setDescription(new TranslatableMarkup('The headings the page renders, in reading order.'))
        ->setTargetBundle($bundle)
        ->setCardinality(FieldStorageDefinitionInterface::CARDINALITY_UNLIMITED)
        ->setComputed(TRUE)
        ->setReadOnly(TRUE)
        ->setTranslatable(TRUE)
        ->setClass(TableOfContentsItemList::class),
    ];
  }

}
