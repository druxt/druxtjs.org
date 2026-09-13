<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\Core\State\StateInterface;
use Drupal\druxt_docs\Plugin\migrate\source\DocsBlock;
use Drupal\migrate\MigrateException;
use Drupal\migrate\Plugin\MigrateIdMapInterface;
use Drupal\migrate\Plugin\MigrationInterface;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * The block source, which is where the corpus stops being JSON.
 */
#[CoversClass(DocsBlock::class)]
#[Group('druxt_docs')]
final class DocsBlockTest extends UnitTestCase {

  private string $directory;

  protected function setUp(): void {
    parent::setUp();
    $this->directory = sys_get_temp_dir() . '/docs-block-' . uniqid();
    mkdir($this->directory, 0777, TRUE);
  }

  protected function tearDown(): void {
    foreach (glob($this->directory . '/*.json') ?: [] as $file) {
      unlink($file);
    }
    @rmdir($this->directory);
    parent::tearDown();
  }

  /**
   * Every block of every page, in reading order.
   */
  public function testYieldsEveryBlockInOrder(): void {
    $this->write('a', [
      ['type' => 'text', 'markdown' => 'one'],
      ['type' => 'code', 'code' => 'x()', 'language' => 'js'],
      ['type' => 'text', 'markdown' => 'two'],
    ]);
    $rows = $this->rows();
    self::assertSame([0, 1, 2], array_column($rows, 'index'));
    self::assertSame(['text', 'code', 'text'], array_column($rows, 'type'));
  }

  /**
   * A migration takes only the block types it models.
   */
  public function testFiltersToTheRequestedTypes(): void {
    $this->write('a', [
      ['type' => 'text', 'markdown' => 'one'],
      ['type' => 'code', 'code' => 'x()', 'language' => 'js'],
    ]);
    $rows = $this->rows(['types' => ['code']]);
    self::assertCount(1, $rows);
    self::assertSame('code', $rows[0]['type']);
    // The index is the block's position on the page, not its position in
    // the filtered set, because it has to identify the same paragraph
    // whichever migration reads it.
    self::assertSame(1, $rows[0]['index']);
  }

  /**
   * A diagram's own source is renamed, because "source" is taken.
   */
  public function testRenamesTheDiagramSource(): void {
    $this->write('a', [['type' => 'diagram', 'source' => 'flowchart TB', 'syntax' => 'mermaid', 'group' => 'g1']]);
    $rows = $this->rows();
    self::assertSame('flowchart TB', $rows[0]['diagram']);
    self::assertSame('g1', $rows[0]['group'], 'Grouping is content, in a field.');
  }

  /**
   * A block nobody modelled stops the run, whichever migration reads it.
   */
  public function testAnUnknownBlockTypeFails(): void {
    $this->write('a', [['type' => 'text', 'markdown' => 'one'], ['type' => 'video', 'src' => 'x']]);
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/"video" is not a block type this site models/');
    // Asked for text only, and it still fails: a block that would be
    // skipped silently is the failure this guards.
    $this->rows(['types' => ['text']]);
  }

  /**
   * An empty directory is a build failure, not an empty migration.
   */
  public function testAnEmptyDirectoryFails(): void {
    $this->expectException(MigrateException::class);
    $this->rows();
  }

  /**
   * No directory anywhere names the state that should hold it.
   */
  public function testNoDirectoryFails(): void {
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/druxt_docs\.ir_directory/');
    $this->rows([], '');
  }

  /**
   * Each block row says which section it sits in, and the region.
   */
  public function testRowsCarryTheirPlacement(): void {
    $this->write('a', [
      ['type' => 'text', 'markdown' => 'one'],
      ['type' => 'diagram', 'source' => 'a', 'syntax' => 'mermaid', 'group' => 'g'],
      ['type' => 'diagram', 'source' => 'b', 'syntax' => 'mermaid', 'group' => 'g'],
      ['type' => 'text', 'markdown' => 'two'],
    ]);
    $rows = $this->rows();
    self::assertSame([0, 1, 1, 2], array_column($rows, 'layout_section'));
    self::assertSame(['content', 'first', 'second', 'content'], array_column($rows, 'layout_region'));
  }

  /**
   * A group wider than any layout stops the run and names the page.
   */
  public function testAGroupTooWideNamesThePage(): void {
    $this->write('wide', array_fill(0, 4, ['type' => 'diagram', 'source' => 'x', 'syntax' => 'mermaid', 'group' => 'g']));
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/wide\.md: Group "g" has 4 blocks/');
    $this->rows();
  }

  /**
   * Writes one intermediate representation document.
   */
  private function write(string $name, array $blocks): void {
    file_put_contents($this->directory . '/' . $name . '.json', json_encode([
      'source' => 'docs/nuxt/content/' . $name . '.md',
      'url' => '/' . $name,
      'section' => 'how-to',
      'title' => ucfirst($name),
      'blocks' => $blocks,
      'commit' => ['sha' => str_repeat('a', 40), 'subject' => 'docs: write ' . $name],
      'revisions' => [],
    ]));
  }

  /**
   * Runs the source and returns its rows.
   */
  private function rows(array $configuration = [], ?string $directory = NULL): array {
    $state = $this->createMock(StateInterface::class);
    $state->method('get')->willReturn($directory ?? $this->directory);

    $idMap = $this->createMock(MigrateIdMapInterface::class);
    $migration = $this->createMock(MigrationInterface::class);
    $migration->method('getIdMap')->willReturn($idMap);

    $source = new DocsBlock($configuration, 'docs_block', [], $migration, $state);
    $method = (new \ReflectionClass($source))->getMethod('initializeIterator');
    $method->setAccessible(TRUE);
    return iterator_to_array($method->invoke($source), FALSE);
  }

}
