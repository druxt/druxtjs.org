<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\Field\FieldType;

use Drupal\Core\Field\Attribute\FieldType;
use Drupal\Core\Field\FieldItemBase;
use Drupal\Core\Field\FieldStorageDefinitionInterface;
use Drupal\Core\StringTranslation\TranslatableMarkup;
use Drupal\Core\TypedData\DataDefinition;

/**
 * One entry in a table of contents: a heading's anchor id, depth and text.
 *
 * A type of its own, rather than JSON in a string or an untyped map, so that
 * JSON:API sends each entry as an object with an integer depth, and a schema
 * can say what the object holds. It is only ever computed, so it is kept out
 * of the field UI.
 */
#[FieldType(
  id: 'docs_toc_entry',
  label: new TranslatableMarkup('Table of contents entry'),
  description: new TranslatableMarkup('A heading on the page: its anchor id, depth and text.'),
  no_ui: TRUE,
)]
final class TocEntryItem extends FieldItemBase {

  /**
   * {@inheritdoc}
   */
  public static function propertyDefinitions(FieldStorageDefinitionInterface $field_definition): array {
    return [
      'id' => DataDefinition::create('string')
        ->setLabel(new TranslatableMarkup('Anchor id'))
        ->setRequired(TRUE),
      'depth' => DataDefinition::create('integer')
        ->setLabel(new TranslatableMarkup('Depth'))
        ->setRequired(TRUE),
      'text' => DataDefinition::create('string')
        ->setLabel(new TranslatableMarkup('Text'))
        ->setRequired(TRUE),
    ];
  }

  /**
   * {@inheritdoc}
   */
  public static function mainPropertyName(): string {
    return 'id';
  }

  /**
   * {@inheritdoc}
   *
   * Every field type declares columns. A computed field never uses them.
   */
  public static function schema(FieldStorageDefinitionInterface $field_definition): array {
    return [
      'columns' => [
        'id' => ['type' => 'varchar', 'length' => 255, 'not null' => TRUE],
        'depth' => ['type' => 'int', 'size' => 'tiny', 'unsigned' => TRUE, 'not null' => TRUE],
        'text' => ['type' => 'text', 'not null' => TRUE],
      ],
    ];
  }

}
