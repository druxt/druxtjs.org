<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

/**
 * Takes the blockquote marker out of a callout's markdown.
 *
 * The callouts were imported from markdown pages, where a callout was a
 * blockquote. The paragraph type is the callout now, with its own box, so a
 * body that is still a blockquote draws a quote inside the box.
 */
final class CalloutText {

  /**
   * The text without its blockquote marker, when the whole text is one.
   *
   * Every line that has text starts with `>`; a line that is only `>` is a
   * blank line of the quote. Text that is not a blockquote throughout is
   * returned unchanged, so a callout that quotes something on purpose keeps
   * the quote.
   *
   * @param string $markdown
   *   The callout's text.
   *
   * @return string
   *   The text with the marker removed from every line, or the text as given.
   */
  public static function unquote(string $markdown): string {
    $lines = explode("\n", $markdown);
    $quoted = FALSE;
    foreach ($lines as $line) {
      if (trim($line) === '') {
        continue;
      }
      if (!preg_match('/^\s*>/', $line)) {
        return $markdown;
      }
      $quoted = TRUE;
    }
    if (!$quoted) {
      return $markdown;
    }
    $out = array_map(static fn(string $line): string => preg_replace('/^\s*>\s?/', '', $line), $lines);
    return rtrim(implode("\n", $out)) . "\n";
  }

}
