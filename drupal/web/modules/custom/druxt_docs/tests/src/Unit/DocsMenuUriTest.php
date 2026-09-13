<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\Plugin\migrate\process\DocsMenuUri;
use Drupal\migrate\MigrateException;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\Plugin\MigrateIdMapInterface;
use Drupal\migrate\Plugin\MigrationInterface;
use Drupal\migrate\Plugin\MigrationPluginManagerInterface;
use Drupal\migrate\Row;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * A menu link points at a migrated page's node, or at a given URI.
 */
#[CoversClass(DocsMenuUri::class)]
#[Group('druxt_docs')]
final class DocsMenuUriTest extends UnitTestCase {

  public function testAPageBecomesItsNode(): void {
    self::assertSame('entity:node/42', $this->transform(['docs/x.md', NULL]));
  }

  public function testAUriIsUsedAsGiven(): void {
    self::assertSame('internal:/api', $this->transform([NULL, 'internal:/api']));
  }

  public function testBothIsRefused(): void {
    $this->expectException(MigrateException::class);
    $this->transform(['docs/x.md', 'https://example.com']);
  }

  public function testNeitherIsRefused(): void {
    $this->expectException(MigrateException::class);
    $this->transform([NULL, NULL]);
  }

  public function testAPageThatWasNotMigratedFails(): void {
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/docs\/missing\.md has no page/');
    $this->transform(['docs/missing.md', NULL]);
  }

  private function transform(array $value): string {
    $idMap = $this->createMock(MigrateIdMapInterface::class);
    $idMap->method('lookupDestinationIds')->willReturnCallback(
      static fn(array $ids): array => $ids === ['docs/x.md'] ? [[42]] : []
    );
    $migration = $this->createMock(MigrationInterface::class);
    $migration->method('getIdMap')->willReturn($idMap);
    $manager = $this->createMock(MigrationPluginManagerInterface::class);
    $manager->method('createInstance')->willReturn($migration);
    $plugin = new DocsMenuUri(['migration' => 'docs_page'], 'docs_menu_uri', [], $manager);
    return $plugin->transform($value, $this->createMock(MigrateExecutableInterface::class), new Row([], []), 'link/uri');
  }

}
