<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\Toc\TableOfContents;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

/**
 * Reading headings out of markdown and HTML, as buildToc() does.
 *
 * Every markdown expectation is what buildToc()'s own regex gives in Node.
 */
#[CoversClass(TableOfContents::class)]
#[Group('druxt_docs')]
final class TableOfContentsTest extends UnitTestCase {

  /**
   * A heading is one to six # at the start of a line, then whitespace.
   */
  public function testMarkdownHeadingsAreLinesStartingWithHashes(): void {
    $markdown = implode("\n", [
      '# One',
      'Prose with a # in it.',
      '## Two  ',
      '####### Seven is not a heading',
      '#Unspaced is not either',
      '  ## Indented is not either',
      '### Three',
      '',
      '###### Six',
    ]);
    self::assertSame([[1, 'One'], [2, 'Two'], [3, 'Three'], [6, 'Six']], TableOfContents::markdownHeadings($markdown));
  }

  /**
   * Inline code keeps its text and loses its backticks.
   */
  public function testInlineCodeIsUnwrapped(): void {
    self::assertSame(
      [[2, 'The druxt module and nuxt.config.js']],
      TableOfContents::markdownHeadings('## The `druxt` module and `nuxt.config.js`'),
    );
  }

  /**
   * Whitespace, line ends and trimming follow JavaScript, not PCRE.
   */
  #[DataProvider('javaScriptWhitespace')]
  public function testWhitespaceIsJavaScripts(string $line, array $headings): void {
    self::assertSame($headings, TableOfContents::markdownHeadings($line));
  }

  /**
   * Lines whose reading depends on what counts as whitespace.
   */
  public static function javaScriptWhitespace(): array {
    return [
      'a no-break space is whitespace' => ["##\u{A0}Non-breaking", [[2, 'Non-breaking']]],
      'so is an ideographic space' => ["## Ideographic\u{3000}", [[2, 'Ideographic']]],
      'next line is not, though PCRE says it is' => ["##\u{85}Next line", []],
      'nor is a Mongolian vowel separator' => ["##\u{180E}Mongolian", []],
      'a carriage return at the end is trimmed' => ["## Carriage return\r", [[2, 'Carriage return']]],
      'a line separator ends the line early' => ["## Line\u{2028}separator", []],
      'unwrapped code is trimmed as JavaScript trims' => ["## `\u{A0}padded\u{A0}`", [[2, 'padded']]],
      'a heading can be empty' => ['## ', [[2, '']]],
    ];
  }

  /**
   * HTML gives h1 to h6, with the text a reader sees.
   */
  public function testHtmlHeadingsAreHeadingElements(): void {
    $html = '<p>Intro</p><h2>Install <code>druxt</code></h2><h3>  Two' . "\n" . '  lines </h3><h2> </h2>'
      . '<h4 id="ignored">With an id</h4><p>Not a heading</p><h1>Top</h1>';
    self::assertSame(
      [[2, 'Install druxt'], [3, 'Two lines'], [4, 'With an id'], [1, 'Top']],
      TableOfContents::htmlHeadings($html),
    );
    self::assertSame([], TableOfContents::htmlHeadings('<p>No headings</p>'));
  }

  /**
   * Blocks share one page's ids, in order, and each page starts afresh.
   */
  public function testIdsAreNumberedAcrossAPage(): void {
    $blocks = [
      ['markdown' => "## Setup\n\nText.\n\n### `druxt` options"],
      ['html' => '<h2>Setup</h2>'],
      ['markdown' => 'No heading here.'],
      ['markdown' => '## Setup'],
    ];
    $expected = [
      ['id' => 'setup', 'depth' => 2, 'text' => 'Setup'],
      ['id' => 'druxt-options', 'depth' => 3, 'text' => 'druxt options'],
      ['id' => 'setup-1', 'depth' => 2, 'text' => 'Setup'],
      ['id' => 'setup-2', 'depth' => 2, 'text' => 'Setup'],
    ];
    self::assertSame($expected, TableOfContents::build($blocks));
    self::assertSame($expected, TableOfContents::build($blocks));
    self::assertSame([], TableOfContents::build([]));
  }

}
