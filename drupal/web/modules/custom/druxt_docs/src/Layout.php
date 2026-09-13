<?php

declare(strict_types=1);

namespace Drupal\druxt_docs;

/**
 * Arranges a page's blocks into layout_paragraphs sections.
 *
 * Every block has to sit in a section, because the page's blocks field
 * requires layouts. A run of ungrouped blocks shares one single-column
 * section. A run of blocks carrying the same group becomes a section with
 * one column per block, which is how a row of diagrams keeps its row.
 *
 * Pure, so the arrangement can be tested without Drupal, and so the
 * section migration and the block migrations agree on it by calling the
 * same code rather than by each deriving it.
 */
final class Layout {

  /**
   * The layout for ungrouped blocks, and its only region.
   */
  public const SINGLE = 'layout_onecol';
  public const SINGLE_REGION = 'content';

  /**
   * The layout for a group of each size, and its regions in reading order.
   */
  public const COLUMNS = [
    2 => ['layout_twocol', ['first', 'second']],
    3 => ['layout_threecol_33_34_33', ['first', 'second', 'third']],
  ];

  /**
   * Every layout a section may use.
   *
   * @return list<string>
   */
  public static function layouts(): array {
    return array_merge([self::SINGLE], array_map(static fn(array $c): string => $c[0], array_values(self::COLUMNS)));
  }

  /**
   * The sections for a page, in order.
   *
   * @param array<int, array> $blocks
   *   The page's blocks, keyed by their position on the page.
   *
   * @return list<array{layout: string, blocks: array<int, string>}>
   *   Each section's layout and its blocks, keyed by block position, with
   *   the region each one sits in.
   *
   * @throws \InvalidArgumentException
   *   When a group has more blocks than any layout has columns. That stops
   *   the run rather than dropping blocks or stacking them into one column.
   */
  public static function sections(array $blocks): array {
    $runs = [];
    foreach ($blocks as $index => $block) {
      $group = $block['group'] ?? NULL;
      $group = ($group === '' ? NULL : $group);
      $last = array_key_last($runs);
      if ($last !== NULL && $runs[$last]['group'] === $group) {
        $runs[$last]['indexes'][] = $index;
        continue;
      }
      $runs[] = ['group' => $group, 'indexes' => [$index]];
    }

    $sections = [];
    foreach ($runs as $run) {
      $count = count($run['indexes']);
      if ($run['group'] === NULL || $count === 1) {
        $sections[] = [
          'layout' => self::SINGLE,
          'blocks' => array_fill_keys($run['indexes'], self::SINGLE_REGION),
        ];
        continue;
      }
      if (!isset(self::COLUMNS[$count])) {
        throw new \InvalidArgumentException(sprintf('Group "%s" has %d blocks, and no layout has that many columns.', $run['group'], $count));
      }
      [$layout, $regions] = self::COLUMNS[$count];
      $sections[] = [
        'layout' => $layout,
        'blocks' => array_combine($run['indexes'], $regions),
      ];
    }
    return $sections;
  }

  /**
   * Where one block sits: its section's position and its region.
   *
   * @return array{section: int, region: string}
   *
   * @throws \OutOfBoundsException
   *   When the page has no block at that position.
   */
  public static function placement(array $blocks, int $index): array {
    foreach (self::sections($blocks) as $position => $section) {
      if (isset($section['blocks'][$index])) {
        return ['section' => $position, 'region' => $section['blocks'][$index]];
      }
    }
    throw new \OutOfBoundsException(sprintf('No block at position %d.', $index));
  }

  /**
   * The behavior settings layout_paragraphs stores on a section.
   *
   * Its layout, and no parent. layout_paragraphs reads a page's structure
   * from these rather than from the field, so this is the module's own
   * shape exactly.
   *
   * @return array{layout_paragraphs: array{layout: string, config: array, parent_uuid: string, region: string}}
   *   The settings.
   */
  public static function sectionBehavior(string $layout): array {
    return ['layout_paragraphs' => ['layout' => $layout, 'config' => ['label' => ''], 'parent_uuid' => '', 'region' => '']];
  }

  /**
   * The behavior settings layout_paragraphs stores on a block.
   *
   * The UUID of the section it sits in, and the region within it.
   *
   * @return array{layout_paragraphs: array{layout: string, config: array, parent_uuid: string, region: string}}
   *   The settings.
   */
  public static function blockBehavior(string $section_uuid, string $region): array {
    return ['layout_paragraphs' => ['layout' => '', 'config' => [], 'parent_uuid' => $section_uuid, 'region' => $region]];
  }

}
