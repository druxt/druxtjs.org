<?php

declare(strict_types=1);

namespace Drupal\druxt_docs;

use Drupal\druxt_docs\Plugin\migrate\source\DocsBlock;

/**
 * A page's earlier versions, as the importer saves them.
 *
 * The IR carries every version of a page but the current one, oldest first,
 * each with the commit it comes from. This checks them, and turns one into
 * the paragraphs its revision holds. Pure, so the shape of a revision can be
 * tested without Drupal, and so the destination that saves them only saves.
 */
final class History {

  /**
   * The form every IR date takes: isoDate() in scripts/lib/history.mjs.
   */
  public const DATE_FORMAT = 'Y-m-d\TH:i:sP';

  /**
   * The text format prose is stored in, as the paragraph migrations store it.
   */
  public const TEXT_FORMAT = 'docs_markdown';

  /**
   * A revision's log message: its commit's subject, then the short sha.
   *
   * @throws \InvalidArgumentException
   *   When the sha is not a full commit sha.
   */
  public static function log(string $subject, string $sha): string {
    if (!preg_match('/^[0-9a-f]{40}$/', $sha)) {
      throw new \InvalidArgumentException(sprintf('"%s" is not a full commit sha.', $sha));
    }
    return trim(sprintf('%s (%s)', trim($subject), substr($sha, 0, 7)));
  }

  /**
   * An IR date as a timestamp.
   *
   * @throws \InvalidArgumentException
   *   When the date is not in the one form the builder writes.
   */
  public static function timestamp(string $date): int {
    $parsed = \DateTimeImmutable::createFromFormat('!' . self::DATE_FORMAT, $date);
    if ($parsed === FALSE || $parsed->format(self::DATE_FORMAT) !== $date) {
      throw new \InvalidArgumentException(sprintf('"%s" is not a date in the form %s.', $date, self::DATE_FORMAT));
    }
    return $parsed->getTimestamp();
  }

  /**
   * A page's earlier versions, checked, oldest first.
   *
   * Checked rather than trusted, because a malformed version would become a
   * revision with a wrong date or no content, and a history that is quietly
   * wrong reads exactly like one that is right.
   *
   * @param mixed $revisions
   *   The document's "revisions", as the IR holds them.
   * @param string $page
   *   The page's source path, to name in a failure.
   *
   * @return list<array{sha: string, timestamp: int, log: string, title: string, description: ?string, blocks: list<array>}>
   *   The versions.
   *
   * @throws \InvalidArgumentException
   *   Naming the page and the version, when any version is malformed.
   */
  public static function versions(mixed $revisions, string $page): array {
    if (!is_array($revisions) || !array_is_list($revisions)) {
      throw new \InvalidArgumentException(sprintf('%s: "revisions" is not a list of versions.', $page));
    }
    $versions = [];
    $seen = [];
    foreach ($revisions as $position => $revision) {
      $sha = is_array($revision) ? ($revision['sha'] ?? NULL) : NULL;
      if (!is_string($sha) || !preg_match('/^[0-9a-f]{40}$/', $sha)) {
        throw new \InvalidArgumentException(sprintf('%s: earlier version %d names no full commit sha.', $page, $position));
      }
      $label = sprintf('%s at %s', $page, substr($sha, 0, 12));
      if (isset($seen[$sha])) {
        throw new \InvalidArgumentException(sprintf('%s: two earlier versions come from the same commit.', $label));
      }
      $seen[$sha] = TRUE;
      foreach (['date', 'subject', 'title'] as $key) {
        if (!is_string($revision[$key] ?? NULL)) {
          throw new \InvalidArgumentException(sprintf('%s: no %s.', $label, $key));
        }
      }
      if (trim($revision['title']) === '') {
        throw new \InvalidArgumentException(sprintf('%s: an empty title.', $label));
      }
      $description = $revision['description'] ?? NULL;
      if ($description !== NULL && !is_string($description)) {
        throw new \InvalidArgumentException(sprintf('%s: a description that is not text.', $label));
      }
      $blocks = $revision['blocks'] ?? NULL;
      if (!is_array($blocks) || $blocks === [] || !array_is_list($blocks)) {
        throw new \InvalidArgumentException(sprintf('%s: no blocks.', $label));
      }
      try {
        $timestamp = self::timestamp($revision['date']);
      }
      catch (\InvalidArgumentException $exception) {
        throw new \InvalidArgumentException(sprintf('%s: %s', $label, $exception->getMessage()));
      }
      $versions[] = [
        'sha' => $sha,
        'timestamp' => $timestamp,
        'log' => self::log($revision['subject'], $sha),
        'title' => $revision['title'],
        'description' => $description,
        'blocks' => $blocks,
      ];
    }
    return $versions;
  }

  /**
   * The paragraphs one earlier version of a page is saved with.
   *
   * In the order the page's field holds them: a section, the blocks in it,
   * then the next section. The sections come from Layout::sections(), the
   * behavior settings are the ones DocsLayoutBehavior writes, the fields are
   * the ones each block's paragraph migration writes, and every UUID is
   * keyed on the commit, so two imports of the same history make the same
   * entities.
   *
   * @param string $page
   *   The page's source path.
   * @param string $sha
   *   The commit the version comes from.
   * @param list<array> $blocks
   *   The version's blocks.
   * @param callable(string): (int|string) $media
   *   The media entity an image path was migrated to.
   *
   * @return list<array<string, mixed>>
   *   Values for each paragraph entity, with its bundle as "type".
   *
   * @throws \InvalidArgumentException
   *   When a block is of a type this site does not model, or a group has
   *   more blocks than any layout has columns.
   */
  public static function paragraphs(string $page, string $sha, array $blocks, callable $media): array {
    $paragraphs = [];
    foreach (Layout::sections($blocks) as $position => $section) {
      $section_uuid = Identity::revisionSectionParagraph($page, $sha, $position);
      $paragraphs[] = [
        'type' => 'docs_layout_section',
        'uuid' => $section_uuid,
        'langcode' => 'en',
        'behavior_settings' => serialize(Layout::sectionBehavior($section['layout'])),
      ];
      foreach ($section['blocks'] as $index => $region) {
        $type = $blocks[$index]['type'] ?? '';
        if (!isset(DocsBlock::BUNDLES[$type])) {
          throw new \InvalidArgumentException(sprintf('block %d: "%s" is not a block type this site models.', $index, $type));
        }
        $paragraphs[] = [
          'type' => DocsBlock::BUNDLES[$type],
          'uuid' => Identity::revisionParagraph($page, $sha, $index),
          'langcode' => 'en',
          'behavior_settings' => serialize(Layout::blockBehavior($section_uuid, $region)),
        ] + self::fields($blocks[$index], $media);
      }
    }
    return $paragraphs;
  }

  /**
   * A block's fields, as its paragraph migration writes them.
   */
  private static function fields(array $block, callable $media): array {
    return match ($block['type']) {
      'text' => [
        'field_text' => ['value' => $block['markdown'] ?? '', 'format' => self::TEXT_FORMAT],
      ],
      'callout' => [
        'field_callout' => ['value' => $block['markdown'] ?? '', 'format' => self::TEXT_FORMAT],
        'field_callout_type' => $block['callout'] ?? NULL,
      ],
      'code' => [
        'field_code' => $block['code'] ?? NULL,
        'field_language' => $block['language'] ?? NULL,
      ],
      'diagram' => [
        'field_diagram' => $block['source'] ?? NULL,
        'field_syntax' => $block['syntax'] ?? NULL,
        'field_group' => $block['group'] ?? NULL,
      ],
      'image' => [
        'field_media' => ['target_id' => $media((string) ($block['src'] ?? ''))],
      ],
      default => throw new \InvalidArgumentException(sprintf('"%s" blocks have no fields here.', $block['type'])),
    };
  }

}
