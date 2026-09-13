<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\source;

use Drupal\druxt_docs\History;
use Drupal\druxt_docs\IntermediateRepresentation;
use Drupal\druxt_docs\Layout;
use Drupal\druxt_docs\Sections;
use Drupal\migrate\Attribute\MigrateSource;
use Drupal\migrate\MigrateException;

/**
 * One row per page, carrying its block keys in reading order.
 *
 * `blocks` holds the identifiers of this page's paragraphs, in order, so
 * the node migration can look each one up and keep the order the page
 * reads in. Order is the property most easily lost here, so it is carried
 * explicitly rather than reconstructed from a query.
 *
 * `revisions` passes the page's earlier versions through as the IR holds
 * them, for the docs_page destination to save as revisions.
 */
#[MigrateSource(id: 'docs_document')]
final class DocsDocument extends DocsSourceBase {

  /**
   * {@inheritdoc}
   */
  public function fields(): array {
    return [
      'source' => 'Path of the markdown file the page came from',
      'url' => 'Public URL, which becomes the path alias',
      'section' => 'Section machine name',
      'title' => 'Page title',
      'description' => 'Page description',
      'weight' => 'Order within the section',
      'isLanding' => 'Whether the page is its section landing page',
      'items' => 'Sections and blocks, in the order the page reads',
      'created' => 'When the page was written, from git',
      'changed' => 'When the page last changed, from git',
      'commit' => 'The commit that last changed the page: its sha and subject',
      'revision_log' => 'The current version\'s log: that commit\'s subject and short sha',
      'revisions' => 'The page\'s earlier versions, oldest first',
      'menu_title' => 'The page\'s title in the documentation menu',
      'menu_weight' => 'The page\'s order in that menu',
      'menu_parent' => 'The page its menu link sits under, if any',
    ];
  }

  /**
   * {@inheritdoc}
   */
  public function getIds(): array {
    return ['source' => ['type' => 'string']];
  }

  /**
   * {@inheritdoc}
   */
  protected function initializeIterator(): \Iterator {
    $documents = $this->documents();
    // Each section's landing page, which its other pages sit under.
    try {
      $landings = IntermediateRepresentation::landings($documents);
    }
    catch (\InvalidArgumentException $exception) {
      throw new MigrateException(sprintf('%s: %s', $this->pluginId, $exception->getMessage()));
    }

    $landing = $this->configuration['landing'] ?? NULL;
    $rows = [];
    foreach ($documents as $page => $document) {
      if ($landing !== NULL && (bool) $landing !== !empty($document['isLanding'])) {
        continue;
      }
      // A section, then the blocks in it, then the next section. That is
      // the order layout_paragraphs reads a page's field in.
      try {
        $sections = Layout::sections($document['blocks']);
      }
      catch (\InvalidArgumentException $exception) {
        throw new MigrateException(sprintf('%s: %s', $page, $exception->getMessage()));
      }
      $items = [];
      foreach ($sections as $position => $section) {
        $items[] = ['section' => [$page, $position]];
        foreach (array_keys($section['blocks']) as $index) {
          $items[] = [$page, $index];
        }
      }
      $document['items'] = $items;
      unset($document['blocks']);

      // In the menu, a landing page stands for its section, under the
      // section's own name and in the section's order.
      $is_landing = !empty($document['isLanding']);
      $definition = Sections::ALL[$document['section']] ?? NULL;
      $document['menu_title'] = $is_landing && $definition ? $definition['name'] : $document['title'];
      $document['menu_weight'] = $is_landing && $definition ? $definition['weight'] : (int) ($document['weight'] ?? 0);
      $document['menu_parent'] = $is_landing ? NULL : ($landings[$document['section']] ?? NULL);
      // Normalised here rather than in a process pipeline, because YAML
      // cannot carry a boolean map key and a static_map over true and
      // false is unwritable.
      $document['isLanding'] = (int) !empty($document['isLanding']);

      // The current version is dated to the commit that last changed the
      // page, and logged with it, as each earlier version is with its own.
      $commit = is_array($document['commit'] ?? NULL) ? $document['commit'] : [];
      try {
        $document['revision_log'] = History::log((string) ($commit['subject'] ?? ''), (string) ($commit['sha'] ?? ''));
      }
      catch (\InvalidArgumentException $exception) {
        throw new MigrateException(sprintf('%s: no commit to log the current version with. %s', $page, $exception->getMessage()));
      }
      $rows[] = $document;
    }
    return new \ArrayIterator($rows);
  }

}
