<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\Plugin\migrate\process\DocsParagraphReferences;
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
 * A page's paragraphs are its prose in sequence.
 *
 * Order is what these tests are for. A page whose paragraphs come back
 * reordered, or one short, still passes every count the pipeline takes, so
 * the only place it can be caught is here.
 */
#[CoversClass(DocsParagraphReferences::class)]
#[Group('druxt_docs')]
final class DocsParagraphReferencesTest extends UnitTestCase {

  /**
   * The plugin must be handed the whole block list, not one block at a time.
   *
   * Get reports multiple() for an array source, so without handle_multiples
   * Migrate iterates the list and calls transform once per block. The
   * plugin then reads a single [page, index] pair as two separate blocks.
   * That is a real defect this project shipped and caught; this is the
   * regression test for it.
   */
  public function testDeclaresHandleMultiples(): void {
    $attributes = (new \ReflectionClass(DocsParagraphReferences::class))
      ->getAttributes(\Drupal\migrate\Attribute\MigrateProcess::class);
    self::assertCount(1, $attributes, 'The plugin declares exactly one MigrateProcess attribute.');
    self::assertTrue($attributes[0]->newInstance()->handle_multiples);
  }

  /**
   * References come back in the order the page gave them.
   *
   * The destination ids deliberately descend where the page ascends, so a
   * plugin that sorted, or that returned map order, produces a different
   * answer from one that follows the page. An earlier version of this test
   * used ascending ids and passed against a plugin that sorted, which is
   * the failure it exists to catch.
   */
  public function testKeepsTheOrderOfTheBlocks(): void {
    $plugin = $this->plugin([
      'text' => ['p:0' => [9, 90], 'p:2' => [7, 70]],
      'code' => ['p:1' => [8, 80]],
    ]);

    $result = $plugin->transform([['p', 0], ['p', 1], ['p', 2]], $this->executable(), $this->row(), 'field_content');

    self::assertSame([
      ['target_id' => 9, 'target_revision_id' => 90],
      ['target_id' => 8, 'target_revision_id' => 80],
      ['target_id' => 7, 'target_revision_id' => 70],
    ], $result, 'The middle block comes from a different migration and still lands in the middle, and the order is the page\'s rather than the ids\'.');
  }

  /**
   * A block in no migration stops the run rather than shortening the page.
   */
  public function testABlockWithNoParagraphFails(): void {
    $plugin = $this->plugin(['text' => ['p:0' => [7, 70]]]);
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/block p:1 has no paragraph/');
    $plugin->transform([['p', 0], ['p', 1]], $this->executable(), $this->row(), 'field_content');
  }

  /**
   * A block in two migrations is ambiguous, so it stops the run too.
   */
  public function testABlockInTwoMigrationsFails(): void {
    $plugin = $this->plugin([
      'text' => ['p:0' => [7, 70]],
      'code' => ['p:0' => [8, 80]],
    ]);
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/in more than one paragraph migration/');
    $plugin->transform([['p', 0]], $this->executable(), $this->row(), 'field_content');
  }

  /**
   * A revisioned reference needs both ids, so one is not enough.
   */
  public function testADestinationWithoutARevisionFails(): void {
    $plugin = $this->plugin(['text' => ['p:0' => [7]]]);
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/needs two/');
    $plugin->transform([['p', 0]], $this->executable(), $this->row(), 'field_content');
  }

  /**
   * An empty block list means the source lost them, not that a page is empty.
   */
  public function testAnEmptyBlockListFails(): void {
    $plugin = $this->plugin(['text' => []]);
    $this->expectException(MigrateException::class);
    $plugin->transform([], $this->executable(), $this->row(), 'field_content');
  }

  /**
   * Builds the plugin over fake maps.
   *
   * @param array<string, array<string, array<int>>> $maps
   *   Migration name to a map of "page:index" to destination ids.
   */
  private function plugin(array $maps): DocsParagraphReferences {
    $manager = $this->createMock(MigrationPluginManagerInterface::class);
    $instances = [];
    foreach ($maps as $name => $rows) {
      $idMap = $this->createMock(MigrateIdMapInterface::class);
      $idMap->method('lookupDestinationIds')->willReturnCallback(
        static function (array $source) use ($rows): array {
          $key = implode(':', array_map('strval', $source));
          return isset($rows[$key]) ? [$rows[$key]] : [];
        }
      );
      $migration = $this->createMock(MigrationInterface::class);
      $migration->method('getIdMap')->willReturn($idMap);
      $instances[$name] = $migration;
    }
    $manager->method('createInstance')->willReturnCallback(
      static fn(string $name) => $instances[$name] ?? NULL
    );

    return new DocsParagraphReferences(
      ['migrations' => array_keys($maps)],
      'docs_paragraph_references',
      [],
      $manager,
    );
  }

  private function executable(): MigrateExecutableInterface {
    return $this->createMock(MigrateExecutableInterface::class);
  }

  private function row(): Row {
    return new Row(['source' => 'p'], ['source' => ['type' => 'string']]);
  }

  /**
   * A section comes before the blocks in it, in the page's order.
   */
  public function testSectionsInterleaveWithTheirBlocks(): void {
    $plugin = $this->pluginWithSections(
      ['text' => ['p:0' => [9, 90], 'p:1' => [8, 80]], 'code' => ['p:2' => [7, 70]]],
      ['p:0' => [30, 300], 'p:1' => [20, 200]],
    );
    $result = $plugin->transform([['section' => ['p', 0]], ['p', 0], ['p', 1], ['section' => ['p', 1]], ['p', 2]], $this->executable(), $this->row(), 'field_content');
    self::assertSame([30, 9, 8, 20, 7], array_column($result, 'target_id'));
  }

  /**
   * A section is looked up only among sections.
   *
   * The block migration holds the same identifiers, so a lookup that
   * searched everything would find two paragraphs, or the wrong one.
   */
  public function testASectionIsNeverLookedUpAmongBlocks(): void {
    $plugin = $this->pluginWithSections(['text' => ['p:0' => [9, 90]]], ['p:0' => [30, 300]]);
    $result = $plugin->transform([['section' => ['p', 0]], ['p', 0]], $this->executable(), $this->row(), 'field_content');
    self::assertSame([30, 9], array_column($result, 'target_id'));
  }

  /**
   * A section with nowhere to look it up stops the run.
   */
  public function testASectionWithoutASectionMigrationFails(): void {
    $plugin = $this->pluginWithSections(['text' => ['p:0' => [9, 90]]], [], FALSE);
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/no "section_migration"/');
    $plugin->transform([['section' => ['p', 0]]], $this->executable(), $this->row(), 'field_content');
  }

  /**
   * A section with no paragraph stops the run and names itself.
   */
  public function testAMissingSectionFails(): void {
    $plugin = $this->pluginWithSections(['text' => []], ['p:0' => [30, 300]]);
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/p:1 has no paragraph in any of sections/');
    $plugin->transform([['section' => ['p', 1]]], $this->executable(), $this->row(), 'field_content');
  }

  /**
   * Builds the plugin over block maps and a section map.
   */
  private function pluginWithSections(array $maps, array $sections, bool $configure = TRUE): DocsParagraphReferences {
    $all = $maps + ($configure ? ['sections' => $sections] : []);
    $instances = [];
    foreach ($all as $name => $rows) {
      $idMap = $this->createMock(MigrateIdMapInterface::class);
      $idMap->method('lookupDestinationIds')->willReturnCallback(
        static function (array $source) use ($rows): array {
          $key = implode(':', array_map('strval', $source));
          return isset($rows[$key]) ? [$rows[$key]] : [];
        }
      );
      $migration = $this->createMock(MigrationInterface::class);
      $migration->method('getIdMap')->willReturn($idMap);
      $instances[$name] = $migration;
    }
    $manager = $this->createMock(MigrationPluginManagerInterface::class);
    $manager->method('createInstance')->willReturnCallback(static fn(string $name) => $instances[$name] ?? NULL);
    $configuration = ['migrations' => array_keys($maps)];
    if ($configure) {
      $configuration['section_migration'] = 'sections';
    }
    return new DocsParagraphReferences($configuration, 'docs_paragraph_references', [], $manager);
  }

}
