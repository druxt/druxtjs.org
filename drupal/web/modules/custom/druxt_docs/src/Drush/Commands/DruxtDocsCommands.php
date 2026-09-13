<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Drush\Commands;

use Drupal\druxt_docs\IntermediateRepresentation;
use Drush\Attributes as CLI;
use Drush\Commands\DrushCommands;

/**
 * Inspects the intermediate representation the documentation is built from.
 *
 * The markdown is parsed outside Drupal, and the migrations in this module
 * write the result into content. This command reads the same input and
 * says what is in it, without writing anything.
 */
final class DruxtDocsCommands extends DrushCommands {

  /**
   * Reports what an intermediate representation directory contains.
   *
   * Reading the input and saying what is in it is a separate act from
   * importing it, and worth having on its own: it is how a broken or stale
   * IR is caught before anything touches content.
   */
  #[CLI\Command(name: 'druxt-docs:inspect')]
  #[CLI\Argument(name: 'directory', description: 'Directory of intermediate representation documents.')]
  #[CLI\Usage(name: 'drush druxt-docs:inspect ../ir', description: 'Summarise the documents in ../ir.')]
  public function inspect(string $directory): int {
    $documents = IntermediateRepresentation::load($directory, $error);
    if ($documents === NULL) {
      $this->logger()->error($error);
      return self::EXIT_FAILURE;
    }

    $blocks = [];
    foreach ($documents as $document) {
      foreach ($document['blocks'] ?? [] as $block) {
        $type = $block['type'] ?? 'unknown';
        $blocks[$type] = ($blocks[$type] ?? 0) + 1;
      }
    }
    ksort($blocks);

    $this->io()->writeln(sprintf('%d documents in %s', count($documents), $directory));
    foreach ($blocks as $type => $count) {
      $this->io()->writeln(sprintf('  %-16s %d', $type, $count));
    }

    return self::EXIT_SUCCESS;
  }

}
