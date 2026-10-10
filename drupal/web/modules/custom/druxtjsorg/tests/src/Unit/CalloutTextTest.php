<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\druxtjsorg\CalloutText;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * A callout written as a blockquote loses the marker, and nothing else does.
 */
#[CoversClass(CalloutText::class)]
#[Group('druxtjsorg')]
final class CalloutTextTest extends UnitTestCase {

  /**
   * The imported shape: every line quoted, the label kept in bold.
   */
  public function testABlockquoteLosesItsMarkerAndKeepsItsText(): void {
    $markdown = "> **Before you start:** the [login flow\n> tutorial](/tutorials/authentication) uses the quickstart's ready-made\n> OAuth setup.";
    self::assertSame("**Before you start:** the [login flow\ntutorial](/tutorials/authentication) uses the quickstart's ready-made\nOAuth setup.\n", CalloutText::unquote($markdown));
  }

  /**
   * A quote with a blank line, written as a bare marker, stays one paragraph break.
   */
  public function testABlankQuotedLineIsABlankLine(): void {
    self::assertSame("One.\n\nTwo.\n", CalloutText::unquote("> One.\n>\n> Two.\n"));
  }

  /**
   * Program output is one quoted line.
   */
  public function testASingleLineIsUnquoted(): void {
    self::assertSame("Missing Vue template for the 'umami_search' block\n", CalloutText::unquote("> Missing Vue template for the 'umami_search' block"));
  }

  /**
   * Text that is not a blockquote throughout is left alone, so the hook can run again.
   */
  public function testTextThatIsNotWhollyQuotedIsLeftAlone(): void {
    foreach (["Plain text.\n", "Intro.\n\n> A quote on purpose.\n", "", "\n\n"] as $markdown) {
      self::assertSame($markdown, CalloutText::unquote($markdown));
    }
  }

}
