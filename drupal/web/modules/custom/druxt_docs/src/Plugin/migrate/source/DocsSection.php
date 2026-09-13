<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\source;

use Drupal\druxt_docs\Sections;
use Drupal\migrate\Attribute\MigrateSource;
use Drupal\migrate\MigrateException;
use Drupal\migrate\Plugin\migrate\source\SourcePluginBase;

/**
 * One row per documentation section.
 *
 * The sections are a fixed set this site defines rather than something the
 * corpus carries, so this reads them from the shared definition. It still
 * checks the corpus against them, because a section in the corpus with no
 * definition would otherwise fail much later, in the block source, with a
 * page attached but no explanation.
 */
#[MigrateSource(id: 'docs_section')]
final class DocsSection extends SourcePluginBase {

  /**
   * {@inheritdoc}
   */
  public function fields(): array {
    return [
      'machine' => 'Machine name, which the route segment matches',
      'name' => 'Term name',
      'weight' => 'Sidebar order',
    ];
  }

  /**
   * {@inheritdoc}
   */
  public function getIds(): array {
    return ['machine' => ['type' => 'string']];
  }

  /**
   * {@inheritdoc}
   */
  protected function initializeIterator(): \Iterator {
    $rows = [];
    foreach (Sections::ALL as $machine => $definition) {
      $rows[] = ['machine' => $machine] + $definition;
    }
    if ($rows === []) {
      throw new MigrateException('docs_section: no sections are defined.');
    }
    return new \ArrayIterator($rows);
  }

  /**
   * {@inheritdoc}
   */
  public function __toString(): string {
    return 'docs_section';
  }

}
