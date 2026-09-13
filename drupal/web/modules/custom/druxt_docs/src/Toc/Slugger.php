<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Toc;

/**
 * A port of github-slugger 1.5.0, which gives headings their ids.
 *
 * The IR builder slugs with github-slugger, as did the site the
 * documentation came from, so any anchor ever linked to is one of its slugs.
 * This reproduces it exactly: lowercase as JavaScript does, remove what its
 * regex.js removes, turn spaces into hyphens, and number repeats -1, -2 and
 * so on. JsTables holds what JavaScript and regex.js do to each code point,
 * measured in Node rather than read from either.
 *
 * Repeats are counted per instance, so a page needs one of its own.
 */
final class Slugger {

  /**
   * How many times each slug has repeated so far.
   *
   * @var array<array-key, int>
   */
  private array $occurrences = [];

  /**
   * The slug for a value, unique among the slugs this instance has given.
   */
  public function slug(string $value): string {
    $slug = self::slugify($value);
    $original = $slug;
    while (array_key_exists($slug, $this->occurrences)) {
      $this->occurrences[$original]++;
      $slug = $original . '-' . $this->occurrences[$original];
    }
    $this->occurrences[$slug] = 0;
    return $slug;
  }

  /**
   * Forgets every slug given so far.
   */
  public function reset(): void {
    $this->occurrences = [];
  }

  /**
   * The slug for a value, repeats aside: github-slugger's static slug().
   */
  public static function slugify(string $value): string {
    $slug = preg_replace('/' . JsTables::SLUG_REMOVE . '/u', '', self::lowercase($value));
    return str_replace(' ', '-', $slug ?? '');
  }

  /**
   * JavaScript's String.prototype.toLowerCase().
   *
   * Not mb_strtolower(), which follows the Unicode version PHP was built
   * with rather than Node's. Capital sigma is the one letter whose lowercase
   * depends on its neighbours: it becomes ς at the end of a word.
   */
  public static function lowercase(string $value): string {
    if (!str_contains($value, 'Σ')) {
      return strtr($value, JsTables::LOWERCASE);
    }
    $characters = preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $lower = '';
    foreach ($characters as $index => $character) {
      if ($character === 'Σ') {
        $final = self::casedBeside($characters, $index, -1) && !self::casedBeside($characters, $index, 1);
        $lower .= $final ? 'ς' : 'σ';
        continue;
      }
      $lower .= JsTables::LOWERCASE[$character] ?? $character;
    }
    return $lower;
  }

  /**
   * Whether the nearest letter one way from a position is cased.
   *
   * Case-ignorable characters, such as accents and apostrophes, are skipped.
   *
   * @param list<string> $characters
   *   The string, one character per element.
   * @param int $index
   *   The position to look from.
   * @param int $step
   *   -1 to look back, 1 to look ahead.
   */
  private static function casedBeside(array $characters, int $index, int $step): bool {
    for ($i = $index + $step; isset($characters[$i]); $i += $step) {
      if (preg_match('/^' . JsTables::SIGMA_IGNORABLE . '$/Du', $characters[$i]) !== 1) {
        return preg_match('/^' . JsTables::SIGMA_CASED . '$/Du', $characters[$i]) === 1;
      }
    }
    return FALSE;
  }

}
