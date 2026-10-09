<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

/**
 * Reads the hand-written lists out of a page's markdown.
 *
 * Pages ended with a "## Where to go next" heading and a list of links, and
 * each section landing listed its pages under a heading of its own. Both are
 * served from Drupal now: the links from the page's field, the landing's list
 * from the docs_section view. This takes the links out of the text and the
 * sections with them, once, in a deploy hook.
 */
final class NextSteps {

  /**
   * The heading a page's next steps were written under.
   */
  public const HEADING = 'Where to go next';

  /**
   * The list of links under the "Where to go next" heading, and the text without it.
   *
   * A list item is `- [Text](/path)`, optionally followed by `: a description`
   * or a sentence before the link, which are dropped: a page on this site is
   * described by its own description now, and a generated page by its text.
   *
   * @param string $markdown
   *   The paragraph's text.
   *
   * @return array{links: array<int, array{title: string, path: string}>, text: string}
   *   The links in order, and the text with the section removed. Without the
   *   section, no links and the text unchanged.
   */
  public static function extract(string $markdown): array {
    $lines = explode("\n", $markdown);
    foreach ($lines as $at => $line) {
      $at = (int) $at;
      if (!preg_match('/^##\s+' . preg_quote(self::HEADING, '/') . '\s*$/', $line)) {
        continue;
      }
      $end = count($lines);
      for ($i = $at + 1; $i < count($lines); $i++) {
        if (preg_match('/^##?\s/', $lines[$i])) {
          $end = $i;
          break;
        }
      }
      $body = array_slice($lines, $at + 1, $end - $at - 1);
      $rest = array_merge(array_slice($lines, 0, $at), array_slice($lines, $end));
      return ['links' => self::links($body), 'text' => self::join($rest)];
    }
    return ['links' => [], 'text' => $markdown];
  }

  /**
   * The list of links under a landing's heading, and the text without it.
   *
   * A landing's list is the first heading followed by a list of two or more
   * items that each link to this site. The heading and the list go; the
   * prose before and after them stays.
   *
   * @param string $markdown
   *   The landing's text.
   *
   * @return array{links: array<int, array{title: string, path: string}>, text: string}
   *   The links, and the text with that heading and list removed.
   */
  public static function extractLanding(string $markdown): array {
    $lines = explode("\n", $markdown);
    foreach ($lines as $at => $line) {
      $at = (int) $at;
      if (!preg_match('/^##\s+\S/', $line)) {
        continue;
      }
      $i = $at + 1;
      while ($i < count($lines) && trim($lines[$i]) === '') {
        $i++;
      }
      $start = $i;
      $items = 0;
      while ($i < count($lines) && (preg_match('/^[-*]\s+\[[^\]]+\]\(\/[^)]*\)/', $lines[$i]) || preg_match('/^\s+\S/', $lines[$i]))) {
        $items += (int) preg_match('/^[-*]\s/', $lines[$i]);
        $i++;
      }
      if ($items < 2) {
        continue;
      }
      $body = array_slice($lines, $start, $i - $start);
      $rest = array_merge(array_slice($lines, 0, $at), array_slice($lines, $i));
      return ['links' => self::links($body), 'text' => self::join($rest)];
    }
    return ['links' => [], 'text' => $markdown];
  }

  /**
   * The link field URI for a list item's path.
   *
   * @param string $path
   *   The path the markdown link names.
   * @param int|null $nid
   *   The node the path resolves to on this site, if any.
   *
   * @return string
   *   `entity:node/N` for a page here, the URL itself for an absolute one,
   *   and `internal:` before any other path. Drupal refuses an `internal:`
   *   URI that does not start with a slash, and the refusal surfaces as a
   *   500 on every read of the page.
   */
  public static function uri(string $path, ?int $nid): string {
    if ($nid) {
      return "entity:node/$nid";
    }
    return preg_match('#^[a-z][a-z0-9+.-]*:#i', $path) ? $path : 'internal:' . $path;
  }

  /**
   * The links a markdown list holds, one per item, in order.
   *
   * @param string[] $lines
   *   The list's lines, continuation lines included.
   *
   * @return array<int, array{title: string, path: string}>
   *   Each item's first link: its text and its path.
   */
  private static function links(array $lines): array {
    $links = [];
    foreach (preg_split('/\n(?=[-*]\s)/', trim(implode("\n", $lines))) as $item) {
      if (preg_match('/\[(?<title>[^\]]+)\]\((?<path>[^)\s]+)\)/', $item, $m)) {
        $links[] = ['title' => trim(preg_replace('/\s+/', ' ', $m['title'])), 'path' => $m['path']];
      }
    }
    return $links;
  }

  /**
   * The lines as text, with the gap the removal left closed to one blank line.
   *
   * @param string[] $lines
   *   The remaining lines.
   *
   * @return string
   *   The text, ending in one newline.
   */
  private static function join(array $lines): string {
    return rtrim(preg_replace("/\n{3,}/", "\n\n", implode("\n", $lines))) . "\n";
  }

}
