<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\Toc\Slugger;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

/**
 * The port of github-slugger 1.5.0.
 *
 * Every expected value is what github-slugger 1.5.0 or JavaScript's
 * toLowerCase() returns in Node for the same input. Characters that are hard
 * to see are written as escapes.
 */
#[CoversClass(Slugger::class)]
#[Group('druxt_docs')]
final class SluggerTest extends UnitTestCase {

  /**
   * Punctuation, symbols and invisible characters go; each space is a hyphen.
   */
  #[DataProvider('punctuation')]
  public function testPunctuationIsRemoved(string $value, string $slug): void {
    self::assertSame($slug, Slugger::slugify($value));
  }

  /**
   * Values with punctuation, symbols, spaces and invisible characters.
   */
  public static function punctuation(): array {
    return [
      'comma and bang' => ['Hello, World!', 'hello-world'],
      'apostrophe and dots' => ["What's new in 0.25?", 'whats-new-in-025'],
      'ampersand, colon and backticks' => ['Props & slots: `druxt-entity`', 'props--slots-druxt-entity'],
      'plus and hash' => ['C++ & C#', 'c--c'],
      'a dotted version' => ['1.2.3', '123'],
      'an em dash' => ["a\u{2014}b em dash", 'ab-em-dash'],
      'every space a hyphen' => ['  two  spaces  ', '--two--spaces--'],
      'a tab' => ["tab\there", 'tabhere'],
      'a no-break space' => ["nbsp\u{A0}here", 'nbsphere'],
      'a zero-width space' => ["zero\u{200B}width", 'zerowidth'],
      'a soft hyphen' => ["a\u{AD}b soft hyphen", 'ab-soft-hyphen'],
      'a control character' => ["\u{1} control", '-control'],
    ];
  }

  /**
   * The characters regex.js leaves alone besides letters and digits.
   */
  #[DataProvider('kept')]
  public function testUnderscoresAndHyphensAreKept(string $value, string $slug): void {
    self::assertSame($slug, Slugger::slugify($value));
  }

  /**
   * Values with underscores and hyphens.
   */
  public static function kept(): array {
    return [
      'snake and kebab case' => ['snake_case and kebab-case', 'snake_case-and-kebab-case'],
      'nothing but' => ['-_- kept', '-_--kept'],
      'an object key JavaScript treats specially' => ['__proto__', '__proto__'],
    ];
  }

  /**
   * Letters and combining marks in any script stay, lowercased.
   */
  #[DataProvider('unicode')]
  public function testUnicodeLettersAndMarksAreKept(string $value, string $slug): void {
    self::assertSame($slug, Slugger::slugify($value));
  }

  /**
   * Values in other scripts, with marks, and with numbers that are symbols.
   */
  public static function unicode(): array {
    return [
      // Ünïcödé Ñame.
      'Latin with diacritics' => ["\u{DC}n\u{EF}c\u{F6}d\u{E9} \u{D1}ame", "\u{FC}n\u{EF}c\u{F6}d\u{E9}-\u{F1}ame"],
      'a combining acute accent' => ["Cafe\u{301} decomposed", "cafe\u{301}-decomposed"],
      // Ελληνικά.
      'Greek' => ["\u{395}\u{3BB}\u{3BB}\u{3B7}\u{3BD}\u{3B9}\u{3BA}\u{3AC}", "\u{3B5}\u{3BB}\u{3BB}\u{3B7}\u{3BD}\u{3B9}\u{3BA}\u{3AC}"],
      // ΟΔΥΣΣΕΥΣ, whose last sigma is final.
      'Greek with a final sigma' => ["\u{39F}\u{394}\u{3A5}\u{3A3}\u{3A3}\u{395}\u{3A5}\u{3A3}", "\u{3BF}\u{3B4}\u{3C5}\u{3C3}\u{3C3}\u{3B5}\u{3C5}\u{3C2}"],
      // Русский.
      'Cyrillic' => ["\u{420}\u{443}\u{441}\u{441}\u{43A}\u{438}\u{439}", "\u{440}\u{443}\u{441}\u{441}\u{43A}\u{438}\u{439}"],
      // 中文标题.
      'Han' => ["\u{4E2D}\u{6587}\u{6807}\u{9898}", "\u{4E2D}\u{6587}\u{6807}\u{9898}"],
      // हिन्दी, with vowel signs and a virama.
      'Devanagari' => ["\u{939}\u{93F}\u{928}\u{94D}\u{926}\u{940}", "\u{939}\u{93F}\u{928}\u{94D}\u{926}\u{940}"],
      // İstanbul, whose capital lowercases to two characters.
      'dotted capital I' => ["\u{130}stanbul", "i\u{307}stanbul"],
      'a Roman numeral' => ["\u{216B} roman", "\u{217B}-roman"],
      'fullwidth Latin' => ["\u{FF21}\u{FF42}\u{FF43} fullwidth", "\u{FF41}\u{FF42}\u{FF43}-fullwidth"],
      'an astral letter' => ["\u{10400} deseret", "\u{10428}-deseret"],
      'fractions and superscripts' => ["\u{BD} and \u{B2}", '-and-'],
      'a circled digit' => ["\u{2460} circled", '-circled'],
    ];
  }

  /**
   * Emoji go, and so does the joiner between them, but not a keycap's marks.
   */
  #[DataProvider('emoji')]
  public function testEmojiAreRemoved(string $value, string $slug): void {
    self::assertSame($slug, Slugger::slugify($value));
  }

  /**
   * Values with emoji.
   */
  public static function emoji(): array {
    return [
      'a rocket' => ["\u{1F680} Launch", '-launch'],
      'a joined sequence' => ["Emoji \u{1F469}\u{200D}\u{1F4BB} dev", 'emoji--dev'],
      'a flag' => ["Flag \u{1F1E6}\u{1F1FA} AU", 'flag--au'],
      'a keycap' => ["Keycap 1\u{FE0F}\u{20E3}", "keycap-1\u{FE0F}\u{20E3}"],
    ];
  }

  /**
   * Lowercasing is JavaScript's, which is neither strtolower() nor mbstring.
   */
  #[DataProvider('lowercase')]
  public function testLowercasesAsJavaScriptDoes(string $value, string $lower): void {
    self::assertSame($lower, Slugger::lowercase($value));
  }

  /**
   * Values whose lowercase PHP's own functions get wrong somewhere.
   */
  public static function lowercase(): array {
    return [
      // ΑΣ, ΑΣΑ, Σ, ΑΣ.: a capital sigma ending a word becomes ς.
      'sigma ending a word' => ["\u{391}\u{3A3}", "\u{3B1}\u{3C2}"],
      'sigma inside a word' => ["\u{391}\u{3A3}\u{391}", "\u{3B1}\u{3C3}\u{3B1}"],
      'sigma on its own' => ["\u{3A3}", "\u{3C3}"],
      'sigma before punctuation' => ["\u{391}\u{3A3}.", "\u{3B1}\u{3C2}."],
      'sigma after a modifier letter, which is skipped' => ["\u{391}\u{2B0}\u{3A3}", "\u{3B1}\u{2B0}\u{3C2}"],
      'sigma after only a modifier letter' => ["\u{2B0}\u{3A3}", "\u{2B0}\u{3C3}"],
      'sigma before an accent, then a letter' => ["\u{391}\u{3A3}\u{301}\u{391}", "\u{3B1}\u{3C3}\u{301}\u{3B1}"],
      'dotted capital I' => ["\u{130}", "i\u{307}"],
      // Letters from Unicode 16 and 17, which the Node the tables came from
      // lowercases and mbstring in PHP 8.3 (and, for 17, 8.4) does not.
      'a Unicode 16 Cyrillic letter' => ["\u{1C89}", "\u{1C8A}"],
      'a Unicode 17 Latin letter' => ["\u{A7CE}", "\u{A7CF}"],
      'a Unicode 17 astral letter' => ["\u{16EA0}", "\u{16EBB}"],
    ];
  }

  /**
   * A repeat is numbered until unique, and a numbered slug can itself repeat.
   */
  public function testRepeatsAreNumbered(): void {
    $slugger = new Slugger();
    $values = ['Setup', 'Setup-1', 'Setup', 'Setup', 'setup', 'Setup-1', 'Setup', '', '', '-1'];
    $slugs = array_map([$slugger, 'slug'], $values);
    self::assertSame(['setup', 'setup-1', 'setup-2', 'setup-3', 'setup-4', 'setup-1-1', 'setup-5', '', '-1', '-1-1'], $slugs);
  }

  /**
   * Reset forgets every slug, and instances never share any.
   */
  public function testResetForgetsRepeats(): void {
    $slugger = new Slugger();
    $slugger->slug('Setup');
    self::assertSame('setup-1', $slugger->slug('Setup'));
    $slugger->reset();
    self::assertSame('setup', $slugger->slug('Setup'));
    self::assertSame('setup', (new Slugger())->slug('Setup'));
  }

}
