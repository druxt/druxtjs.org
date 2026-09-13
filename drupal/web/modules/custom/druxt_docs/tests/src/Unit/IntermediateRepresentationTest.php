<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\IntermediateRepresentation;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

#[CoversClass(IntermediateRepresentation::class)]
#[Group('druxt_docs')]
final class IntermediateRepresentationTest extends UnitTestCase {

  /**
   * Directory holding this test's fixtures.
   */
  private string $directory;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->directory = sys_get_temp_dir() . '/druxt-docs-ir-' . uniqid();
    mkdir($this->directory);
  }

  /**
   * {@inheritdoc}
   */
  protected function tearDown(): void {
    foreach (glob($this->directory . '/*') ?: [] as $file) {
      unlink($file);
    }
    @rmdir($this->directory);
    parent::tearDown();
  }

  /**
   * Writes a fixture document.
   */
  private function write(string $name, array|string $document): void {
    file_put_contents(
      $this->directory . '/' . $name,
      is_string($document) ? $document : json_encode($document),
    );
  }

  /**
   * A minimal valid document.
   */
  private function document(string $source = 'how-to/theming.md'): array {
    return [
      'source' => $source,
      'url' => '/how-to/theming',
      'section' => 'how-to',
      'title' => 'Theme Druxt components',
      'blocks' => [['type' => 'text', 'markdown' => 'Hello.']],
      'commit' => ['sha' => str_repeat('a', 40), 'subject' => 'docs: theme Druxt components'],
      'revisions' => [],
    ];
  }

  public function testLoadsAndKeysBySource(): void {
    $this->write('b.json', $this->document('how-to/theming.md'));
    $this->write('a.json', $this->document('explanation/routing.md'));

    $documents = IntermediateRepresentation::load($this->directory, $error);

    $this->assertNull($error);
    $this->assertSame(
      ['explanation/routing.md', 'how-to/theming.md'],
      array_keys($documents),
      'Documents are keyed by source path and sorted, so import order does not depend on filenames.',
    );
  }

  public function testMissingDirectoryReports(): void {
    $this->assertNull(IntermediateRepresentation::load($this->directory . '/absent', $error));
    $this->assertStringContainsString('No such directory', (string) $error);
  }

  public function testEmptyDirectoryReports(): void {
    $this->assertNull(IntermediateRepresentation::load($this->directory, $error));
    $this->assertStringContainsString('No documents found', (string) $error);
  }

  public function testInvalidJsonReports(): void {
    $this->write('broken.json', '{"source": ');

    $this->assertNull(IntermediateRepresentation::load($this->directory, $error));
    $this->assertStringContainsString('Invalid JSON', (string) $error);
  }

  /**
   * A document short of a required key must not import as a partial page.
   */
  public function testMissingKeysReportsEveryMissingKey(): void {
    $document = $this->document();
    unset($document['title'], $document['blocks']);
    $this->write('partial.json', $document);

    $this->assertNull(IntermediateRepresentation::load($this->directory, $error));
    $this->assertStringContainsString('title', (string) $error);
    $this->assertStringContainsString('blocks', (string) $error);
  }

  /**
   * A source that is not a path is a validation error, not a crash.
   */
  public function testSourceMustBePath(): void {
    $this->write('a.json', ['source' => []] + $this->document());
    $this->assertNull(IntermediateRepresentation::load($this->directory, $error));
    $this->assertStringContainsString('source is not a path', $error);
  }

  /**
   * Two landing pages for one section would fight over its other pages.
   */
  public function testTwoLandingPagesForOneSectionAreRefused(): void {
    $documents = [
      'how-to/README.md' => ['isLanding' => TRUE] + $this->document('how-to/README.md'),
      'how-to/index.md' => ['isLanding' => TRUE] + $this->document('how-to/index.md'),
      'how-to/theming.md' => $this->document(),
    ];
    $this->expectException(\InvalidArgumentException::class);
    $this->expectExceptionMessageMatches('/Two landing pages claim the how-to section: how-to\/README\.md and how-to\/index\.md/');
    IntermediateRepresentation::landings($documents);
  }

  /**
   * One landing page per section is the map the document source builds on.
   */
  public function testLandingsKeyEachSectionBySource(): void {
    $documents = [
      'how-to/README.md' => ['isLanding' => TRUE] + $this->document('how-to/README.md'),
      'how-to/theming.md' => $this->document(),
      'tutorials/README.md' => ['isLanding' => TRUE, 'section' => 'tutorials'] + $this->document('tutorials/README.md'),
    ];
    $this->assertSame(['how-to' => 'how-to/README.md', 'tutorials' => 'tutorials/README.md'], IntermediateRepresentation::landings($documents));
  }

  /**
   * A document without its history must not import as a page with none.
   *
   * An empty history is a page with one version. A missing one is a builder
   * that stopped writing it, and every page would import without its past.
   */
  public function testMissingHistoryReports(): void {
    $document = $this->document();
    unset($document['commit'], $document['revisions']);
    $this->write('no-history.json', $document);

    $this->assertNull(IntermediateRepresentation::load($this->directory, $error));
    $this->assertStringContainsString('commit, revisions', (string) $error);
  }

  /**
   * Two documents claiming one source would silently drop a page.
   */
  public function testDuplicateSourceReports(): void {
    $this->write('one.json', $this->document());
    $this->write('two.json', $this->document());

    $this->assertNull(IntermediateRepresentation::load($this->directory, $error));
    $this->assertStringContainsString('same source', (string) $error);
  }

  /**
   * One bad document must fail the whole load, not yield a partial corpus.
   */
  public function testOneBadDocumentFailsTheWholeLoad(): void {
    $this->write('good.json', $this->document());
    $this->write('bad.json', '{');

    $this->assertNull(IntermediateRepresentation::load($this->directory, $error));
  }

}
