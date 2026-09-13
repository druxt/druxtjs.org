<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\process;

use Drupal\druxt_docs\Identity;
use Drupal\migrate\Attribute\MigrateProcess;
use Drupal\migrate\MigrateException;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;

/**
 * The deterministic UUID for an entity, derived from its source.
 *
 * Identity is unchanged by the move to Migrate: the same function produces
 * the same UUIDs, so a site seeded by the importer and a site seeded by
 * these migrations hold the same identifiers and neither orphans a
 * reference to the other.
 *
 * @code
 * uuid:
 *   plugin: docs_identity
 *   kind: page
 *   source: source
 * @endcode
 */
#[MigrateProcess(id: 'docs_identity')]
final class DocsIdentity extends ProcessPluginBase {

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property): string {
    $kind = $this->configuration['kind'] ?? '';
    if (is_array($value)) {
      $value = implode(':', $value);
    }
    $value = (string) $value;
    if ($value === '') {
      throw new MigrateException(sprintf('docs_identity: nothing to derive a %s identifier from.', $kind ?: 'entity'));
    }
    return match ($kind) {
      'page' => Identity::page($value),
      'alias' => Identity::alias($value),
      'media' => Identity::media($value),
      'file' => Identity::file($value),
      'section' => Identity::section($value),
      'user' => Identity::user($value),
      'consumer' => Identity::consumer($value),
      'menu_link' => $this->menuLink($value),
      'paragraph' => $this->paragraph($value),
      'section_paragraph' => $this->sectionParagraph($value),
      default => throw new MigrateException(sprintf('docs_identity: "%s" is not a kind of identifier this site derives.', $kind)),
    };
  }

  /**
   * A menu link's identifier, whose source is its menu and a key.
   */
  private function menuLink(string $value): string {
    [$menu, $key] = explode(':', $value, 2) + ['', ''];
    if ($menu === '' || $key === '') {
      throw new MigrateException(sprintf('docs_identity: a menu link identifier needs a menu and a key, not "%s".', $value));
    }
    return Identity::menuLink($menu, $key);
  }

  /**
   * A section's identifier, whose source is a page path and its position.
   */
  private function sectionParagraph(string $value): string {
    $parts = explode(':', $value);
    $position = array_pop($parts);
    $page = implode(':', $parts);
    if ($page === '' || !ctype_digit((string) $position)) {
      throw new MigrateException(sprintf('docs_identity: a section identifier needs a page and a position, not "%s".', $value));
    }
    return Identity::sectionParagraph($page, (int) $position);
  }

  /**
   * A paragraph identifier, whose source is a page path and a block index.
   */
  private function paragraph(string $value): string {
    $parts = explode(':', $value);
    $index = array_pop($parts);
    $page = implode(':', $parts);
    if ($page === '' || !ctype_digit((string) $index)) {
      throw new MigrateException(sprintf('docs_identity: a paragraph identifier needs a page and a block index, not "%s".', $value));
    }
    return Identity::paragraph($page, (int) $index);
  }

}
