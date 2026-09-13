<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\process;

use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\migrate\Attribute\MigrateProcess;
use Drupal\migrate\MigrateException;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\Plugin\MigrationPluginManagerInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Resolves a page's blocks into ordered paragraph references.
 *
 * `entity_reference_revisions` needs a target id and a target revision id
 * for every reference, and the paragraph migration's map holds both. This
 * looks each block up and emits the pairs in the order the page gave them.
 *
 * Order is the whole point. A page's paragraphs are its prose in sequence,
 * so a lookup that returns them in map order, or drops one and closes the
 * gap, produces a page that reads wrongly while every count still agrees.
 * The page's own block list drives this loop, not any map, which is why
 * splitting the paragraphs across one migration per bundle costs nothing
 * here. Nothing sorts, dedupes or skips: a block found in no map stops the
 * run and names itself, because the alternative is a page quietly short a
 * paragraph.
 *
 * An item written as `['section' => [page, position]]` is a layout section,
 * looked up only in `section_migration`, so its identifiers are never
 * compared against a block migration's.
 *
 * @code
 * field_content:
 *   plugin: docs_paragraph_references
 *   section_migration: docs_paragraph_layout
 *   migrations:
 *     - docs_paragraph_text
 *     - docs_paragraph_code
 *   source: blocks
 * @endcode
 */
// handle_multiples, because the pipeline hands this plugin the page's whole
// block list. Without it, Get reports multiple() for an array source and
// Migrate calls transform once per block, so the plugin would see a single
// [page, index] pair and iterate its two scalars as if they were two
// blocks. That failure is loud here only because every lookup is asserted;
// a plugin that returned early would have produced pages with one
// paragraph each and no error at all.
#[MigrateProcess(id: 'docs_paragraph_references', handle_multiples: TRUE)]
final class DocsParagraphReferences extends ProcessPluginBase implements ContainerFactoryPluginInterface {

  public function __construct(
    array $configuration,
    string $plugin_id,
    mixed $plugin_definition,
    private readonly MigrationPluginManagerInterface $migrationManager,
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition);
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition): self {
    return new self($configuration, $plugin_id, $plugin_definition, $container->get('plugin.manager.migration'));
  }

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property): array {
    $names = $this->configuration['migrations'] ?? [];
    if (!is_array($names) || $names === []) {
      throw new MigrateException('docs_paragraph_references: no "migrations" configured.');
    }
    if (!is_array($value)) {
      throw new MigrateException('docs_paragraph_references: expected a list of blocks.');
    }
    if ($value === []) {
      // Every page in this corpus has at least one block, so an empty list
      // means the source lost them rather than that the page is empty.
      throw new MigrateException(sprintf('docs_paragraph_references: %s has no blocks.', (string) $row->getSourceIdValues()['source'] ?? 'a page'));
    }

    $maps = [];
    foreach ($names as $name) {
      $migration = $this->migrationManager->createInstance($name);
      if ($migration === NULL) {
        throw new MigrateException(sprintf('docs_paragraph_references: there is no "%s" migration.', $name));
      }
      $maps[$name] = $migration->getIdMap();
    }

    $section_map = NULL;
    $section_name = $this->configuration['section_migration'] ?? NULL;
    if ($section_name !== NULL) {
      $section_migration = $this->migrationManager->createInstance($section_name);
      if ($section_migration === NULL) {
        throw new MigrateException(sprintf('docs_paragraph_references: there is no "%s" migration.', $section_name));
      }
      $section_map = $section_migration->getIdMap();
    }

    $references = [];
    foreach ($value as $position => $ids) {
      $searched = $maps;
      $kind = 'block';
      if (is_array($ids) && array_key_exists('section', $ids)) {
        $kind = 'section';
        if ($section_map === NULL) {
          throw new MigrateException('docs_paragraph_references: a section item arrived, and no "section_migration" is configured.');
        }
        $searched = [$section_name => $section_map];
        $ids = $ids['section'];
      }
      $ids = is_array($ids) ? array_values($ids) : [$ids];
      $label = implode(':', array_map('strval', $ids));
      $found = NULL;
      foreach ($searched as $name => $map) {
        $destination = $map->lookupDestinationIds($ids);
        if ($destination === []) {
          continue;
        }
        $first = reset($destination);
        if (count($first) < 2) {
          throw new MigrateException(sprintf('docs_paragraph_references: %s maps block %s to %d destination id, and a revisioned reference needs two.', $name, $label, count($first)));
        }
        if ($found !== NULL) {
          throw new MigrateException(sprintf('docs_paragraph_references: block %s is in more than one paragraph migration, so which paragraph a page points at depends on the order they were checked.', $label));
        }
        $found = $first;
      }
      if ($found === NULL) {
        throw new MigrateException(sprintf('docs_paragraph_references: %s %s has no paragraph in any of %s. Run them first, and do not let them skip rows.', $kind, $label, implode(', ', array_keys($searched))));
      }
      $references[$position] = [
        'target_id' => $found[0],
        'target_revision_id' => $found[1],
      ];
    }

    // The loop preserves order by construction, so this asserts the thing
    // that would have to go wrong silently for the assertion to matter.
    if (array_keys($references) !== range(0, count($value) - 1)) {
      throw new MigrateException('docs_paragraph_references: the references came back out of order.');
    }
    return array_values($references);
  }

}
