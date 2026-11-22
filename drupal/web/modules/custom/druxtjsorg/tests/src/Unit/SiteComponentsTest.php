<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\druxtjsorg\SiteComponents;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\Group;

/**
 * A Canvas page moves to the site's components, item by item.
 */
#[Group('druxtjsorg')]
final class SiteComponentsTest extends UnitTestCase {

  /**
   * An item with a twin at its version moves, with its inputs untouched.
   */
  public function testAnItemMovesToItsTwin(): void {
    $hero = [
      'uuid' => 'a',
      'component_id' => 'sdc.druxtjsorg.hero',
      'component_version' => 'v1',
      'inputs' => '{"heading":"Druxt"}',
      'parent_uuid' => NULL,
      'slot' => NULL,
    ];
    $action = ['uuid' => 'b', 'component_id' => 'sdc.druxtjsorg.action', 'component_version' => 'v2', 'parent_uuid' => 'a', 'slot' => 'actions'];
    [$items, $moved, $left] = SiteComponents::move([$hero, $action], ['js.hero' => 'v1', 'js.action' => 'v2']);

    self::assertSame(2, $moved);
    self::assertSame([], $left);
    self::assertSame(array_merge($hero, ['component_id' => 'js.hero']), $items[0]);
    self::assertSame('js.hero', $items[0]['component_id']);
    self::assertSame('{"heading":"Druxt"}', $items[0]['inputs']);
    self::assertSame('js.action', $items[1]['component_id']);
    self::assertSame('a', $items[1]['parent_uuid']);
  }

  /**
   * An item stays when its twin is missing, or at another version.
   */
  public function testAnItemWithoutATwinAtItsVersionStays(): void {
    $items = [
      ['component_id' => 'sdc.druxtjsorg.hero', 'component_version' => 'v1'],
      ['component_id' => 'sdc.druxtjsorg.showcase', 'component_version' => 'v1'],
      ['component_id' => 'sdc.druxtjsorg.hero', 'component_version' => 'v1'],
    ];
    [$after, $moved, $left] = SiteComponents::move($items, ['js.hero' => 'v9']);

    self::assertSame(0, $moved);
    self::assertSame($items, $after);
    self::assertSame(['sdc.druxtjsorg.hero', 'sdc.druxtjsorg.showcase'], $left);
  }

  /**
   * Another module's component, a block and the site's own are not Drupal's.
   */
  public function testOtherComponentsAreLeftAlone(): void {
    self::assertNull(SiteComponents::twin('js.hero'));
    self::assertNull(SiteComponents::twin('block.system_branding_block'));
    self::assertNull(SiteComponents::twin('sdc.another_module.teaser'));
    self::assertSame('js.quickstart-command', SiteComponents::twin('sdc.druxtjsorg.quickstart-command'));

    $items = [['component_id' => 'js.hero', 'component_version' => 'v1'], ['component_id' => 'block.page_title_block', 'component_version' => 'v1']];
    self::assertSame([$items, 0, []], SiteComponents::move($items, ['js.hero' => 'v1']));
  }

}
