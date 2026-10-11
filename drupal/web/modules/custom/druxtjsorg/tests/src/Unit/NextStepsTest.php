<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\druxtjsorg\NextSteps;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * The hand-written lists come out of the markdown whole, and nothing else does.
 */
#[CoversClass(NextSteps::class)]
#[Group('druxtjsorg')]
final class NextStepsTest extends UnitTestCase {

  /**
   * A page's "Where to go next" section, as the pages were written.
   */
  public function testThePageSectionIsTakenOutWithItsLinks(): void {
    $markdown = "Druxt inherits all of it,\nat the cost of depending on display-mode config.\n\n## Where to go next\n\n- [Component resolution](/explanation/component-resolution): how the\n  schema's field components meet your theme components.\n- [DruxtSchema API reference](/api/packages/schema).\n";
    $result = NextSteps::extract($markdown);
    self::assertSame([
      ['title' => 'Component resolution', 'path' => '/explanation/component-resolution'],
      ['title' => 'DruxtSchema API reference', 'path' => '/api/packages/schema'],
    ], $result['links']);
    self::assertSame("Druxt inherits all of it,\nat the cost of depending on display-mode config.\n", $result['text']);
  }

  /**
   * A sentence before the link, as the tutorials wrote their items.
   */
  public function testAnItemWithProseBeforeItsLinkKeepsTheLink(): void {
    $markdown = "The same three ideas power every module.\n\n## Where to go next\n\n- Go deeper on overriding: [Theme Druxt components](/how-to/theming).\n- Read the base class reference:\n  [DruxtModule API](/api/packages/druxt/components/DruxtModule).\n";
    $result = NextSteps::extract($markdown);
    self::assertSame([
      ['title' => 'Theme Druxt components', 'path' => '/how-to/theming'],
      ['title' => 'DruxtModule API', 'path' => '/api/packages/druxt/components/DruxtModule'],
    ], $result['links']);
    self::assertSame("The same three ideas power every module.\n", $result['text']);
  }

  /**
   * A section that is not the last keeps what follows it.
   */
  public function testWhatFollowsTheSectionStays(): void {
    $markdown = "Intro.\n\n## Where to go next\n\n- [A](/a)\n\n## Appendix\n\nMore.\n";
    $result = NextSteps::extract($markdown);
    self::assertSame([['title' => 'A', 'path' => '/a']], $result['links']);
    self::assertSame("Intro.\n\n## Appendix\n\nMore.\n", $result['text']);
  }

  /**
   * Without the section nothing changes, so the hook can run again.
   */
  public function testTextWithoutTheSectionIsLeftAlone(): void {
    $markdown = "Just prose.\n\n## Another heading\n\n- [A link](/a) in a list that is not next steps.\n";
    self::assertSame(['links' => [], 'text' => $markdown], NextSteps::extract($markdown));
  }

  /**
   * A landing's list of its pages, between its intro and its closing line.
   */
  public function testTheLandingListIsTakenOutAndTheProseStays(): void {
    $markdown = "How-to guides are **goal-oriented**: recipes.\n\n## Guides\n\n- [Prepare the Drupal backend](/how-to/prepare-the-backend): modules and permissions.\n- [Configure CORS in Drupal](/how-to/configure-cors): let the browser talk to the backend.\n\nFor step-by-step lessons, see [Tutorials](/tutorials).\n";
    $result = NextSteps::extractLanding($markdown);
    self::assertSame([
      ['title' => 'Prepare the Drupal backend', 'path' => '/how-to/prepare-the-backend'],
      ['title' => 'Configure CORS in Drupal', 'path' => '/how-to/configure-cors'],
    ], $result['links']);
    self::assertSame("How-to guides are **goal-oriented**: recipes.\n\nFor step-by-step lessons, see [Tutorials](/tutorials).\n", $result['text']);
    self::assertSame("How-to guides are **goal-oriented**: recipes.\n", $result['before']);
    self::assertSame("For step-by-step lessons, see [Tutorials](/tutorials).\n", $result['after']);
  }

  /**
   * A landing that ends with its list has nothing after it.
   */
  public function testTheLandingThatEndsWithItsListHasNoTextAfter(): void {
    $result = NextSteps::extractLanding("Intro.\n\n## Pages\n\n- [A](/a)\n- [B](/b)\n");
    self::assertSame("Intro.\n", $result['before']);
    self::assertSame('', $result['after']);
    self::assertSame(['type' => 'docs_section_list', 'field_section' => 3, 'field_section_list_style' => 'sequence'], NextSteps::sectionList(3, 'sequence'));
  }

  /**
   * A section with prose among its links is not the list, and stays.
   */
  public function testTheLandingSectionWithProseIsNotTheList(): void {
    $markdown = "Intro.\n\n## Reading\n\nSome prose.\n\n- [A](/a)\n";
    self::assertSame(['links' => [], 'text' => $markdown, 'before' => $markdown, 'after' => ''], NextSteps::extractLanding($markdown));
  }

  /**
   * A page here is its entity, an absolute URL is itself, a path is internal.
   */
  public function testAnAbsoluteUrlIsItsOwnUriAndOtherPathsAreInternal(): void {
    self::assertSame('entity:node/7', NextSteps::uri('/how-to/caching', 7));
    self::assertSame('internal:/api/druxt', NextSteps::uri('/api/druxt', NULL));
    self::assertSame('internal:/how-to/troubleshooting#writes-fail', NextSteps::uri('/how-to/troubleshooting#writes-fail', NULL));
    self::assertSame('https://demo.druxtjs.org', NextSteps::uri('https://demo.druxtjs.org', NULL));
    self::assertSame('mailto:hello@example.com', NextSteps::uri('mailto:hello@example.com', NULL));
  }

}
