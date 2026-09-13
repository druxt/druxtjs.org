<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\process;

use Drupal\druxt_docs\Identity;
use Drupal\druxt_docs\Layout;
use Drupal\migrate\Attribute\MigrateProcess;
use Drupal\migrate\MigrateException;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;

/**
 * The layout_paragraphs settings a section or a block is stored with.
 *
 * layout_paragraphs keeps a page's structure in each paragraph's behavior
 * settings, not in the field: a section records its layout, and a block
 * records the UUID of the section it sits in and the region within it.
 * This writes exactly the shape the module writes, serialized, because the
 * field is a serialized string. The shape is Layout's, which the docs_page
 * destination also writes an earlier version's paragraphs with.
 *
 * @code
 * behavior_settings:
 *   plugin: docs_layout_behavior
 *   role: block
 *   source:
 *     - page
 *     - layout_section
 *     - layout_region
 * @endcode
 */
#[MigrateProcess(id: 'docs_layout_behavior', handle_multiples: TRUE)]
final class DocsLayoutBehavior extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property): string {
    return serialize(match ($this->configuration['role'] ?? '') {
      'section' => $this->section($value),
      'block' => $this->block($value),
      default => throw new MigrateException('docs_layout_behavior: "role" must be "section" or "block".'),
    });
  }

  /**
   * A section's settings: its layout, and no parent.
   */
  private function section(mixed $layout): array {
    if (!is_string($layout) || !in_array($layout, Layout::layouts(), TRUE)) {
      throw new MigrateException(sprintf('docs_layout_behavior: "%s" is not a layout a section may use.', is_scalar($layout) ? $layout : gettype($layout)));
    }
    return Layout::sectionBehavior($layout);
  }

  /**
   * A block's settings: the section it sits in, and the region.
   */
  private function block(mixed $value): array {
    [$page, $position, $region] = array_values(is_array($value) ? $value : []) + [NULL, NULL, NULL];
    if (!is_string($page) || $page === '' || !is_numeric($position) || !is_string($region) || $region === '') {
      throw new MigrateException('docs_layout_behavior: a block needs its page, its section position and its region.');
    }
    return Layout::blockBehavior(Identity::sectionParagraph($page, (int) $position), $region);
  }

}
