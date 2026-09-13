<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Toc;

use Drupal\Component\Utility\Html;

/**
 * The headings a page renders, with the ids the site gives them.
 *
 * A port of buildToc() in scripts/build-ir.mjs, which the import checks it
 * against. Markdown is read line by line with the same regex, inline code is
 * unwrapped, and one Slugger per page numbers repeated ids. Rich text adds
 * the h1 to h6 elements of its HTML; the corpus is markdown, so the IR
 * builder never sees any.
 */
final class TableOfContents {

  /**
   * The entries for a page's blocks.
   *
   * @param list<array{markdown: string}|array{html: string}> $blocks
   *   The page's text blocks in reading order, each as markdown or HTML.
   *
   * @return list<array{id: string, depth: int, text: string}>
   *   One entry per heading.
   */
  public static function build(array $blocks): array {
    $slugger = new Slugger();
    $entries = [];
    foreach ($blocks as $block) {
      $headings = isset($block['html']) ? self::htmlHeadings($block['html']) : self::markdownHeadings($block['markdown'] ?? '');
      foreach ($headings as [$depth, $text]) {
        $entries[] = ['id' => $slugger->slug($text), 'depth' => $depth, 'text' => $text];
      }
    }
    return $entries;
  }

  /**
   * The headings in markdown, read as buildToc() reads them.
   *
   * A line starting with one to six # and whitespace is a heading, and the
   * rest of the line, trimmed and with `inline code` unwrapped, is its text.
   * Fences are paragraphs of their own, so a # comment in one never gets
   * here.
   *
   * @return list<array{0: int, 1: string}>
   *   The depth and text of each heading.
   */
  public static function markdownHeadings(string $markdown): array {
    // /^(#{1,6})\s+(.*?)\s*$/ in JavaScript, whose \s and . are not PCRE's.
    $pattern = '/^(#{1,6})' . JsTables::WHITESPACE . '+(' . JsTables::DOT . '*?)' . JsTables::WHITESPACE . '*$/Du';
    $headings = [];
    foreach (explode("\n", $markdown) as $line) {
      if (preg_match($pattern, $line, $match) === 1) {
        $headings[] = [strlen($match[1]), self::trim((string) preg_replace('/`([^`]*)`/u', '$1', $match[2]))];
      }
    }
    return $headings;
  }

  /**
   * The h1 to h6 elements in HTML, in document order.
   *
   * The text is what the heading shows: its text content, with whitespace
   * collapsed as a browser collapses it. A heading that shows nothing is
   * left out.
   *
   * @return list<array{0: int, 1: string}>
   *   The depth and text of each heading.
   */
  public static function htmlHeadings(string $html): array {
    if (preg_match('/<h[1-6]/i', $html) !== 1) {
      return [];
    }
    $headings = [];
    $elements = (new \DOMXPath(Html::load($html)))->query('//h1|//h2|//h3|//h4|//h5|//h6');
    foreach ($elements ?: [] as $element) {
      $text = self::trim((string) preg_replace('/[\t\n\f\r ]+/', ' ', $element->textContent));
      if ($text !== '') {
        $headings[] = [(int) substr($element->nodeName, 1), $text];
      }
    }
    return $headings;
  }

  /**
   * JavaScript's String.prototype.trim().
   */
  private static function trim(string $value): string {
    $whitespace = JsTables::WHITESPACE;
    return (string) preg_replace("/^$whitespace+|$whitespace+\$/Du", '', $value);
  }

}
