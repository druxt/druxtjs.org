<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\Identity;
use Drupal\druxt_docs\Plugin\migrate\process\DocsLayoutBehavior;
use Drupal\migrate\Attribute\MigrateProcess;
use Drupal\migrate\MigrateException;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\Row;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * The behavior settings layout_paragraphs reads a page's structure from.
 */
#[CoversClass(DocsLayoutBehavior::class)]
#[Group('druxt_docs')]
final class DocsLayoutBehaviorTest extends UnitTestCase {

  /**
   * A section stores its layout and has no parent.
   */
  public function testASectionStoresItsLayout(): void {
    self::assertSame(
      ['layout_paragraphs' => ['layout' => 'layout_threecol_33_34_33', 'config' => ['label' => ''], 'parent_uuid' => '', 'region' => '']],
      unserialize($this->transform('section', 'layout_threecol_33_34_33')),
    );
  }

  /**
   * A block stores the UUID of its section and its region.
   */
  public function testABlockStoresItsSectionAndRegion(): void {
    $settings = unserialize($this->transform('block', ['docs/x.md', 1, 'second']))['layout_paragraphs'];
    self::assertSame(Identity::sectionParagraph('docs/x.md', 1), $settings['parent_uuid']);
    self::assertSame('second', $settings['region']);
    self::assertSame('', $settings['layout'], 'A block is not a layout.');
  }

  /**
   * A layout no section may use is refused.
   */
  public function testAnUnknownLayoutFails(): void {
    $this->expectException(MigrateException::class);
    $this->transform('section', 'layout_twocol_bricks');
  }

  /**
   * A block without a region is refused, rather than floating free.
   */
  public function testABlockWithoutARegionFails(): void {
    $this->expectException(MigrateException::class);
    $this->transform('block', ['docs/x.md', 0, '']);
  }

  /**
   * The plugin takes the whole value, not one element of it at a time.
   */
  public function testDeclaresHandleMultiples(): void {
    $attribute = (new \ReflectionClass(DocsLayoutBehavior::class))->getAttributes(MigrateProcess::class)[0]->newInstance();
    self::assertTrue($attribute->handle_multiples);
  }

  private function transform(string $role, mixed $value): string {
    $plugin = new DocsLayoutBehavior(['role' => $role], 'docs_layout_behavior', []);
    return $plugin->transform($value, $this->createMock(MigrateExecutableInterface::class), new Row([], []), 'behavior_settings');
  }

}
