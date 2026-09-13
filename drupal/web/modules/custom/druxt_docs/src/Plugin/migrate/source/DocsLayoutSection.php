<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\source;

use Drupal\druxt_docs\Layout;
use Drupal\migrate\Attribute\MigrateSource;
use Drupal\migrate\MigrateException;

/**
 * One row per layout section, for every page.
 *
 * The sections come from Layout, the same code the block source uses to
 * place each block in one, so the two migrations cannot disagree about
 * which section a block belongs to.
 */
#[MigrateSource(id: 'docs_layout_section')]
final class DocsLayoutSection extends DocsSourceBase {

  /**
   * {@inheritdoc}
   */
  public function fields(): array {
    return [
      'page' => 'Source path of the page the section belongs to',
      'position' => 'Position of the section among the page\'s sections',
      'layout' => 'Layout plugin ID',
    ];
  }

  /**
   * {@inheritdoc}
   */
  public function getIds(): array {
    return [
      'page' => ['type' => 'string'],
      'position' => ['type' => 'integer'],
    ];
  }

  /**
   * {@inheritdoc}
   */
  protected function initializeIterator(): \Iterator {
    $rows = [];
    foreach ($this->documents() as $page => $document) {
      try {
        $sections = Layout::sections($document['blocks']);
      }
      catch (\InvalidArgumentException $exception) {
        throw new MigrateException(sprintf('%s: %s', $page, $exception->getMessage()));
      }
      if ($sections === []) {
        throw new MigrateException(sprintf('%s: no sections, because the page has no blocks.', $page));
      }
      foreach ($sections as $position => $section) {
        $rows[] = ['page' => $page, 'position' => $position, 'layout' => $section['layout']];
      }
    }
    return new \ArrayIterator($rows);
  }

}
