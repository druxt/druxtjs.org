<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\Layout;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * How a page's blocks are arranged into sections.
 */
#[CoversClass(Layout::class)]
#[Group('druxt_docs')]
final class LayoutTest extends UnitTestCase {

  /**
   * A page with no groups is one single-column section holding everything.
   */
  public function testUngroupedBlocksShareOneSection(): void {
    $sections = Layout::sections([['type' => 'text'], ['type' => 'code'], ['type' => 'text']]);
    self::assertSame([
      ['layout' => 'layout_onecol', 'blocks' => [0 => 'content', 1 => 'content', 2 => 'content']],
    ], $sections);
  }

  /**
   * A row of three diagrams keeps its row, between the prose around it.
   *
   * This is the shape of the deployment-models page, the one grouped
   * construct in the corpus.
   */
  public function testAGroupOfThreeBecomesThreeColumns(): void {
    $sections = Layout::sections([
      ['type' => 'text'],
      ['type' => 'diagram', 'group' => 'group-1'],
      ['type' => 'diagram', 'group' => 'group-1'],
      ['type' => 'diagram', 'group' => 'group-1'],
      ['type' => 'text'],
    ]);
    self::assertSame([
      ['layout' => 'layout_onecol', 'blocks' => [0 => 'content']],
      ['layout' => 'layout_threecol_33_34_33', 'blocks' => [1 => 'first', 2 => 'second', 3 => 'third']],
      ['layout' => 'layout_onecol', 'blocks' => [4 => 'content']],
    ], $sections);
  }

  /**
   * A group of two gets two columns, and two adjacent groups stay apart.
   */
  public function testAdjacentGroupsAreSeparateSections(): void {
    $sections = Layout::sections([
      ['type' => 'diagram', 'group' => 'a'],
      ['type' => 'diagram', 'group' => 'a'],
      ['type' => 'diagram', 'group' => 'b'],
      ['type' => 'diagram', 'group' => 'b'],
    ]);
    self::assertSame(['layout_twocol', 'layout_twocol'], array_column($sections, 'layout'));
    self::assertSame([0 => 'first', 1 => 'second'], $sections[0]['blocks']);
    self::assertSame([2 => 'first', 3 => 'second'], $sections[1]['blocks']);
  }

  /**
   * A group of one is not a row, so it stays in a single column.
   */
  public function testAGroupOfOneIsASingleColumn(): void {
    $sections = Layout::sections([['type' => 'text'], ['type' => 'diagram', 'group' => 'lonely']]);
    self::assertSame(['layout_onecol', 'layout_onecol'], array_column($sections, 'layout'));
  }

  /**
   * More blocks than any layout has columns stops the run.
   */
  public function testAGroupTooWideForAnyLayoutFails(): void {
    $this->expectException(\InvalidArgumentException::class);
    $this->expectExceptionMessageMatches('/has 4 blocks/');
    Layout::sections(array_fill(0, 4, ['type' => 'diagram', 'group' => 'wide']));
  }

  /**
   * Every block is placed exactly once, and no block is invented.
   */
  public function testEveryBlockIsPlacedOnce(): void {
    $blocks = [
      ['type' => 'text'],
      ['type' => 'diagram', 'group' => 'g'],
      ['type' => 'diagram', 'group' => 'g'],
      ['type' => 'text'],
      ['type' => 'code'],
    ];
    $placed = [];
    foreach (Layout::sections($blocks) as $section) {
      $placed = array_merge($placed, array_keys($section['blocks']));
    }
    self::assertSame(array_keys($blocks), $placed);
  }

  /**
   * A block's placement names its section and region.
   */
  public function testPlacement(): void {
    $blocks = [['type' => 'text'], ['type' => 'diagram', 'group' => 'g'], ['type' => 'diagram', 'group' => 'g']];
    self::assertSame(['section' => 1, 'region' => 'second'], Layout::placement($blocks, 2));
    $this->expectException(\OutOfBoundsException::class);
    Layout::placement($blocks, 9);
  }

}
