<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Normalizer;

use Drupal\Core\Field\FieldItemInterface;
use Drupal\jsonapi\Normalizer\FieldItemNormalizer;

/**
 * Denormalizes a serialized single-property field from its flattened form.
 *
 * Core unserializes a property listed in an entity type's
 * serialized_field_property_names when it normalizes it, and JSON:API then
 * flattens a field item with one property to that value. A paragraph's
 * behavior_settings therefore reads {"layout_paragraphs": {...}} on output,
 * which the generic denormalizer rejects as unknown property names on the way
 * back in. Wrapping it in its main property again lets the parent serialize it.
 * The one shape left ambiguous is a value whose only key is the property's
 * own name; that is read as the wrapped item, which is core's own shape.
 */
class SerializedFieldItemNormalizer extends FieldItemNormalizer {

  /**
   * {@inheritdoc}
   */
  public function denormalize($data, $class, $format = NULL, array $context = []): mixed {
    if (is_array($data) && isset($context['field_definition'], $context['resource_type'])) {
      $item_definition = $context['field_definition']->getItemDefinition();
      $field_item = $this->getFieldItemInstance($context['resource_type'], $item_definition);
      $main = $item_definition->getMainPropertyName();
      $properties = array_keys($item_definition->getPropertyDefinitions());
      // A wrapped item carries the property and nothing else. A value that
      // happens to hold a key of that name beside others is still the value.
      if ($main !== NULL && count($properties) === 1 && $this->isSerialized($field_item, $main) && array_keys($data) !== [$main]) {
        $data = [$main => $data];
      }
    }
    return parent::denormalize($data, $class, $format, $context);
  }

  /**
   * Whether the entity type stores the property serialized.
   */
  private function isSerialized(FieldItemInterface $field_item, string $property): bool {
    return in_array($property, $this->getCustomSerializedPropertyNames($field_item), TRUE);
  }

}
