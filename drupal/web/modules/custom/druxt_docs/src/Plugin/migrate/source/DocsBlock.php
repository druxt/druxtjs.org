<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\source;

use Drupal\druxt_docs\Layout;
use Drupal\migrate\Attribute\MigrateSource;
use Drupal\migrate\MigrateException;

/**
 * One row per block, filtered to the types a migration handles.
 *
 * One source, one migration per bundle. A single migration for all five
 * cannot work: its process pipeline would set every bundle's fields on
 * every paragraph, and setting a field a bundle does not have is an error
 * rather than a no-op. Order is not lost by splitting, because the page's
 * own block list drives the references rather than the map does.
 *
 * `types` names the block types a migration wants. Omitting it takes all
 * of them, which is what the corpus survey and the tests use.
 */
#[MigrateSource(id: 'docs_block')]
final class DocsBlock extends DocsSourceBase {

  /**
   * The paragraph bundle for each block type.
   */
  public const BUNDLES = [
    'text' => 'docs_text',
    'code' => 'docs_code',
    'diagram' => 'docs_diagram',
    'callout' => 'docs_callout',
    'image' => 'docs_image',
  ];

  /**
   * {@inheritdoc}
   */
  public function fields(): array {
    return [
      'page' => 'Source path of the page the block belongs to',
      'index' => 'Position of the block within that page',
      'type' => 'Block type, as the intermediate representation names it',
      'markdown' => 'Prose, for text and callout blocks',
      'code' => 'Source, for code blocks',
      'language' => 'Language, for code blocks',
      'diagram' => 'Source, for diagram blocks',
      'syntax' => 'Diagram syntax, currently only mermaid',
      'group' => 'Group a diagram belongs to, where the page groups them',
      'callout' => 'Callout type',
      'src' => 'Image path, for image blocks',
      'layout_section' => 'Position of the section the block sits in',
      'layout_region' => 'Region of that section the block sits in',
    ];
  }

  /**
   * {@inheritdoc}
   */
  public function getIds(): array {
    return [
      'page' => ['type' => 'string'],
      'index' => ['type' => 'integer'],
    ];
  }

  /**
   * {@inheritdoc}
   */
  protected function initializeIterator(): \Iterator {
    return new \ArrayIterator($this->rows());
  }

  /**
   * Every block of every document, flattened.
   *
   * @return array<int, array<string, mixed>>
   *   Rows.
   */
  private function rows(): array {
    $wanted = $this->configuration['types'] ?? array_keys(self::BUNDLES);
    if (!is_array($wanted) || $wanted === []) {
      throw new MigrateException('docs_block: "types" is empty, which would migrate nothing.');
    }
    foreach ($wanted as $type) {
      if (!isset(self::BUNDLES[$type])) {
        throw new MigrateException(sprintf('docs_block: "%s" is not a block type this site models.', $type));
      }
    }

    $rows = [];
    foreach ($this->documents() as $page => $document) {
      try {
        $placements = [];
        foreach (Layout::sections($document['blocks']) as $position => $section) {
          foreach ($section['blocks'] as $member => $region) {
            $placements[$member] = [$position, $region];
          }
        }
      }
      catch (\InvalidArgumentException $exception) {
        throw new MigrateException(sprintf('%s: %s', $page, $exception->getMessage()));
      }
      foreach ($document['blocks'] as $index => $block) {
        $type = $block['type'] ?? '';
        if (!isset(self::BUNDLES[$type])) {
          // Loud, not skipped, and checked for every block rather than only
          // the wanted ones, so a block nobody modelled stops the run
          // whichever migration happens to reach it first. Throwing
          // MigrateSkipRowException here would drop the block instead and
          // leave a page silently short of a paragraph.
          throw new MigrateException(sprintf('%s block %d: "%s" is not a block type this site models.', $page, $index, $type));
        }
        if (!in_array($type, $wanted, TRUE)) {
          continue;
        }
        $rows[] = [
          'page' => $page,
          'index' => $index,
          'type' => $type,
          'markdown' => $block['markdown'] ?? NULL,
          'code' => $block['code'] ?? NULL,
          'language' => $block['language'] ?? NULL,
          // A diagram's own source is under "source" in the intermediate
          // representation, which is also what a document calls its file.
          // Renamed here so a migration never has to know that.
          'diagram' => $type === 'diagram' ? ($block['source'] ?? NULL) : NULL,
          'syntax' => $block['syntax'] ?? NULL,
          'group' => $block['group'] ?? NULL,
          'callout' => $block['callout'] ?? NULL,
          'src' => $block['src'] ?? NULL,
          'layout_section' => $placements[$index][0],
          'layout_region' => $placements[$index][1],
        ];
      }
    }
    return $rows;
  }

}
