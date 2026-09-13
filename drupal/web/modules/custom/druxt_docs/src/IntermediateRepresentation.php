<?php

declare(strict_types=1);

namespace Drupal\druxt_docs;

/**
 * Reads the intermediate representation the markdown stage produces.
 *
 * One JSON document per authored page: its frontmatter, its computed table
 * of contents, and an ordered list of typed blocks. This class is the only
 * place that knows the on-disk shape, so a change to the contract has one
 * place to land on the Drupal side.
 */
final class IntermediateRepresentation {

  /**
   * Every key a document must carry to be worth importing.
   *
   * Including its history, even when that is empty: a builder that stopped
   * writing it would otherwise import every page with no past, plausibly.
   */
  private const REQUIRED_KEYS = ['source', 'url', 'section', 'title', 'blocks', 'commit', 'revisions'];

  /**
   * Loads and validates every document in a directory.
   *
   * Returns NULL rather than a partial set when anything is wrong: a
   * half-read corpus imported as if it were whole is the failure mode worth
   * designing against, because the result looks plausible.
   *
   * @param string $directory
   *   Directory holding the documents.
   * @param string|null $error
   *   Set to the reason when NULL is returned.
   *
   * @return array[]|null
   *   The documents keyed by source path, or NULL on any error.
   */
  public static function load(string $directory, ?string &$error = NULL): ?array {
    $error = NULL;

    if (!is_dir($directory)) {
      $error = sprintf('No such directory: %s', $directory);
      return NULL;
    }

    $files = glob(rtrim($directory, '/') . '/*.json');
    if ($files === FALSE || $files === []) {
      $error = sprintf('No documents found in %s', $directory);
      return NULL;
    }

    $documents = [];
    foreach ($files as $file) {
      $raw = file_get_contents($file);
      if ($raw === FALSE) {
        $error = sprintf('Unreadable: %s', $file);
        return NULL;
      }

      try {
        $document = json_decode($raw, TRUE, 512, JSON_THROW_ON_ERROR);
      }
      catch (\JsonException $exception) {
        $error = sprintf('Invalid JSON in %s: %s', $file, $exception->getMessage());
        return NULL;
      }

      if (!is_array($document)) {
        $error = sprintf('Not an object: %s', $file);
        return NULL;
      }

      $missing = array_diff(self::REQUIRED_KEYS, array_keys($document));
      if ($missing !== []) {
        $error = sprintf('%s is missing: %s', $file, implode(', ', $missing));
        return NULL;
      }

      if (!is_string($document['source']) || $document['source'] === '') {
        $error = sprintf('%s: source is not a path.', $file);
        return NULL;
      }

      if (isset($documents[$document['source']])) {
        $error = sprintf('Two documents claim the same source: %s', $document['source']);
        return NULL;
      }

      $documents[$document['source']] = $document;
    }

    ksort($documents);

    return $documents;
  }

  /**
   * Each section's landing page, keyed by section.
   *
   * @param array<string, array> $documents
   *   The documents, keyed by source.
   *
   * @return array<string, string>
   *   The landing page's source per section.
   *
   * @throws \InvalidArgumentException
   *   When two landing pages claim one section: the other pages of that
   *   section would sit under whichever came last.
   */
  public static function landings(array $documents): array {
    $landings = [];
    foreach ($documents as $page => $document) {
      if (empty($document['isLanding'])) {
        continue;
      }
      $section = (string) ($document['section'] ?? '');
      if (isset($landings[$section])) {
        throw new \InvalidArgumentException(sprintf('Two landing pages claim the %s section: %s and %s.', $section, $landings[$section], $page));
      }
      $landings[$section] = (string) $page;
    }
    return $landings;
  }

}
