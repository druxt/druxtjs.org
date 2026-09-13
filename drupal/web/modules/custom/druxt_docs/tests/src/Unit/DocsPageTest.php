<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\Core\Database\Connection;
use Drupal\Core\Database\Transaction;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\ContentEntityStorageInterface;
use Drupal\Core\Entity\ContentEntityTypeInterface;
use Drupal\Core\Entity\EntityFieldManagerInterface;
use Drupal\Core\Entity\EntityStorageInterface;
use Drupal\Core\Entity\EntityTypeBundleInfoInterface;
use Drupal\Core\Entity\Query\QueryInterface;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Field\FieldTypePluginManagerInterface;
use Drupal\Core\Session\AccountSwitcherInterface;
use Drupal\druxt_docs\Identity;
use Drupal\druxt_docs\Plugin\migrate\destination\DocsPage;
use Drupal\migrate\MigrateException;
use Drupal\migrate\MigrateLookupInterface;
use Drupal\migrate\Plugin\MigrationInterface;
use Drupal\migrate\Row;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * The page destination: history when a page is created, and only then.
 *
 * The node and the storages are fakes that record what was saved, in what
 * order and as what kind of revision, which is the whole of what the
 * destination decides. Whether Drupal then stores it as asked is the
 * import's to show, on a real site.
 */
#[CoversClass(DocsPage::class)]
#[Group('druxt_docs')]
final class DocsPageTest extends UnitTestCase {

  private const PAGE = 'docs/nuxt/content/how-to/proxy.md';

  private const FIRST = '77ab204cfc07b1b2b3b4b5b6b7b8b9babbbcbdbe';

  private const SECOND = 'be2195264b1bc1c2c3c4c5c6c7c8c9cacbcccdce';

  /**
   * The current version's paragraphs, as the paragraph migrations made them.
   */
  private const CURRENT = [
    ['target_id' => 30, 'target_revision_id' => 300],
    ['target_id' => 31, 'target_revision_id' => 310],
  ];

  /**
   * Every node save: the values it was saved with, and how.
   *
   * @var list<array{values: array, new: bool, newRevision: bool}>
   */
  private array $saves = [];

  /**
   * The values of every paragraph created.
   *
   * @var list<array>
   */
  private array $created = [];

  /**
   * Transactions started and rolled back.
   */
  private int $started = 0;

  private int $rolledBack = 0;

  /**
   * Paragraphs deleted, by ID.
   *
   * @var list<int>
   */
  private array $deleted = [];

  /**
   * A new page is saved once per earlier version, oldest first, then twice.
   *
   * Each earlier version is dated and logged to its commit and holds new
   * paragraphs. The current version is saved as a new revision without its
   * paragraphs and then given them in place, so they are not copied into
   * new paragraph revisions the paragraph migrations never recorded.
   */
  public function testANewPageIsSavedWithItsHistoryFirst(): void {
    $this->destination()->import($this->row([$this->version(self::FIRST, 1636498122), $this->version(self::SECOND, 1652753961)]));

    self::assertCount(4, $this->saves);
    [$first, $second, $current, $final] = $this->saves;

    self::assertTrue($first['new'], 'The first earlier version creates the page.');
    self::assertFalse($first['newRevision']);
    self::assertSame('Proxy at 77ab204', $first['values']['title']);
    self::assertSame(1636498122, $first['values']['changed']);
    self::assertSame(1636498122, $first['values']['revision_timestamp']);
    self::assertSame('docs: write the proxy guide (77ab204)', $first['values']['revision_log']);
    self::assertSame([
      Identity::revisionSectionParagraph(self::PAGE, self::FIRST, 0),
      Identity::revisionParagraph(self::PAGE, self::FIRST, 0),
      Identity::revisionParagraph(self::PAGE, self::FIRST, 1),
    ], $this->uuids($first['values']['field_content']));

    self::assertFalse($second['new']);
    self::assertTrue($second['newRevision'], 'Each later version is a new revision.');
    self::assertSame(1652753961, $second['values']['revision_timestamp']);
    self::assertSame(Identity::revisionParagraph(self::PAGE, self::SECOND, 0), $this->uuids($second['values']['field_content'])[1]);

    self::assertTrue($current['newRevision']);
    self::assertSame([], $current['values']['field_content']);
    self::assertSame('Proxy', $current['values']['title']);
    self::assertSame(1788528593, $current['values']['revision_timestamp']);
    self::assertSame('fix(docs): post-merge polish (0e1a9dc)', $current['values']['revision_log']);

    self::assertFalse($final['newRevision'], 'The paragraphs are added in place, to the same revision.');
    self::assertSame(self::CURRENT, $final['values']['field_content']);
    self::assertSame($current['values']['title'], $final['values']['title']);

    self::assertSame(1, $this->started);
    self::assertSame(0, $this->rolledBack);
  }

  /**
   * Every paragraph an earlier version holds is new, dated to its commit.
   */
  public function testAnEarlierVersionsParagraphsAreNewAndDated(): void {
    $this->destination()->import($this->row([$this->version(self::FIRST, 1636498122)]));
    self::assertSame(['docs_layout_section', 'docs_text', 'docs_image'], array_column($this->created, 'type'));
    self::assertSame([1636498122], array_values(array_unique(array_column($this->created, 'created'))));
    self::assertSame(['target_id' => 5], $this->created[2]['field_media'], 'An image points at today\'s media for its path.');
  }

  /**
   * An update writes no history, so a re-run cannot write it twice.
   */
  public function testAnUpdateWritesNoHistory(): void {
    $existing = $this->node(['title' => 'Proxy'], FALSE);
    // Unprocessed, because updating copies each processed property onto the
    // page's fields, which this fake does not have; only the history counts.
    $row = new Row(['source' => self::PAGE, 'revisions' => [$this->version(self::FIRST, 1636498122)]], ['source' => ['type' => 'string']]);
    $this->destination($existing)->import($row, [7]);
    self::assertCount(1, $this->saves);
    self::assertFalse($this->saves[0]['newRevision']);
    self::assertSame([], $this->created);
    self::assertSame(0, $this->started);
  }

  /**
   * A page with no earlier versions is created as the node destination would.
   */
  public function testAPageWithNoHistoryIsSavedOnce(): void {
    $this->destination()->import($this->row([]));
    self::assertCount(1, $this->saves);
    self::assertTrue($this->saves[0]['new']);
    self::assertSame(self::CURRENT, $this->saves[0]['values']['field_content']);
    self::assertSame(0, $this->started);
  }

  /**
   * A failure part way through undoes the whole page and says why.
   */
  public function testAFailurePartWayThroughRollsTheTransactionBack(): void {
    $version = $this->version(self::SECOND, 1652753961);
    $version['blocks'][1]['src'] = '/images/gone.png';
    try {
      $this->destination()->import($this->row([$this->version(self::FIRST, 1636498122), $version]));
      self::fail('The import succeeded without media for an image.');
    }
    catch (MigrateException $exception) {
      self::assertStringContainsString('proxy.md at be2195264b1b: /images/gone.png has no media in docs_media', $exception->getMessage());
    }
    self::assertCount(1, $this->saves, 'The first version was saved before the second failed.');
    self::assertSame(1, $this->rolledBack, 'And the transaction undid it.');
  }

  /**
   * A malformed earlier version stops the row before anything is saved.
   */
  public function testAMalformedVersionStopsTheRow(): void {
    $this->expectException(MigrateException::class);
    $this->expectExceptionMessageMatches('/proxy\.md at 77ab204cfc07: no blocks/');
    try {
      $this->destination()->import($this->row([['blocks' => []] + $this->version(self::FIRST, 1636498122)]));
    }
    finally {
      self::assertSame([], $this->saves);
    }
  }

  /**
   * Rollback deletes the page and the paragraphs only its history held.
   *
   * The current revision's paragraphs are the paragraph migrations' to
   * delete, so they stay.
   */
  public function testRollbackDeletesThePageAndItsHistorysParagraphs(): void {
    $revisions = [
      101 => [['target_id' => 10, 'target_revision_id' => 100], ['target_id' => 11, 'target_revision_id' => 110]],
      102 => [['target_id' => 20, 'target_revision_id' => 200]],
      103 => [],
      104 => self::CURRENT,
    ];
    $node = $this->node(['field_content' => self::CURRENT], FALSE);
    $node->expects($this->once())->method('delete');

    $this->destination($node, $revisions)->rollback(['nid' => 7]);

    self::assertEqualsCanonicalizing([10, 11, 20], $this->deleted);
  }

  /**
   * The destination under test, over fakes.
   *
   * @param \Drupal\Core\Entity\ContentEntityInterface|null $existing
   *   The page the node storage holds, if any.
   * @param array<int, list<array>> $revisions
   *   The page's revisions, by revision ID, as their field_content values.
   */
  private function destination(?ContentEntityInterface $existing = NULL, array $revisions = []): DocsPage {
    $type = $this->createMock(ContentEntityTypeInterface::class);
    $type->method('getKey')->willReturnMap([
      ['id', 'nid'],
      ['bundle', 'type'],
      ['revision', 'vid'],
      ['langcode', 'langcode'],
      ['uuid', 'uuid'],
    ]);
    $type->method('getPluralLabel')->willReturn('content items');

    $query = $this->createMock(QueryInterface::class);
    foreach (['allRevisions', 'accessCheck', 'condition'] as $method) {
      $query->method($method)->willReturnSelf();
    }
    $query->method('execute')->willReturn(array_fill_keys(array_keys($revisions), 7));

    $nodes = $this->createMock(ContentEntityStorageInterface::class);
    $nodes->method('getEntityType')->willReturn($type);
    $nodes->method('create')->willReturnCallback(fn(array $values): ContentEntityInterface => $this->node($values, TRUE));
    $nodes->method('load')->willReturnCallback(static fn($id) => $id == 7 ? $existing : NULL);
    $nodes->method('getQuery')->willReturn($query);
    $nodes->method('loadMultipleRevisions')->willReturnCallback(fn(array $ids): array => array_map(
      fn(int $id): ContentEntityInterface => $this->node(['field_content' => $revisions[$id]], FALSE),
      array_combine($ids, $ids),
    ));

    $paragraphs = $this->createMock(EntityStorageInterface::class);
    $paragraphs->method('create')->willReturnCallback(function (array $values): ContentEntityInterface {
      $this->created[] = $values;
      $paragraph = $this->createMock(ContentEntityInterface::class);
      $paragraph->method('uuid')->willReturn($values['uuid']);
      return $paragraph;
    });
    $paragraphs->method('loadMultiple')->willReturnCallback(static fn(array $ids): array => array_combine($ids, $ids));
    $paragraphs->method('delete')->willReturnCallback(function (array $entities): void {
      $this->deleted = array_merge($this->deleted, array_map('intval', array_values($entities)));
    });

    $lookup = $this->createMock(MigrateLookupInterface::class);
    $lookup->method('lookup')->willReturnCallback(
      static fn(string $migration, array $ids): array => $migration === 'docs_media' && $ids === ['/images/a.png'] ? [['mid' => 5]] : [],
    );

    $test = $this;
    $transaction = new class($test) extends Transaction {

      public function __construct(private readonly DocsPageTest $test) {}

      public function __destruct() {}

      public function rollBack() {
        $this->test->rolledBack();
      }

    };
    $database = $this->createMock(Connection::class);
    $database->method('startTransaction')->willReturnCallback(function () use ($transaction): Transaction {
      $this->started++;
      return $transaction;
    });

    return new DocsPage(
      ['default_bundle' => 'doc_page', 'media_migration' => 'docs_media'],
      'docs_page',
      [],
      $this->createMock(MigrationInterface::class),
      $nodes,
      ['doc_page'],
      $this->createMock(EntityFieldManagerInterface::class),
      $this->createMock(FieldTypePluginManagerInterface::class),
      $this->createMock(AccountSwitcherInterface::class),
      $this->createMock(EntityTypeBundleInfoInterface::class),
      $paragraphs,
      $lookup,
      $database,
    );
  }

  /**
   * Counts a transaction rolled back.
   */
  public function rolledBack(): void {
    $this->rolledBack++;
  }

  /**
   * A node that records each save.
   */
  private function node(array $values, bool $new): ContentEntityInterface {
    $state = (object) ['values' => $values, 'new' => $new, 'newRevision' => FALSE];
    $node = $this->createMock(ContentEntityInterface::class);
    $node->method('isNew')->willReturnCallback(static fn(): bool => $state->new);
    $node->method('enforceIsNew')->willReturnCallback(static function (bool $value = TRUE) use ($state, $node) {
      $state->new = $value;
      return $node;
    });
    $node->method('isValidationRequired')->willReturn(FALSE);
    $node->method('id')->willReturn(7);
    $node->method('get')->willReturnCallback(function (string $field) use ($state): FieldItemListInterface {
      $list = $this->createMock(FieldItemListInterface::class);
      $list->method('getValue')->willReturn($state->values[$field] ?? []);
      return $list;
    });
    $node->method('set')->willReturnCallback(static function (string $field, $value) use ($state, $node) {
      $state->values[$field] = $value;
      return $node;
    });
    $node->method('setNewRevision')->willReturnCallback(static function (bool $value = TRUE) use ($state): void {
      $state->newRevision = $value;
    });
    $node->method('setSyncing')->willReturnSelf();
    $node->method('save')->willReturnCallback(function () use ($state): int {
      $this->saves[] = ['values' => $state->values, 'new' => $state->new, 'newRevision' => $state->newRevision];
      $state->new = FALSE;
      $state->newRevision = FALSE;
      return 1;
    });
    return $node;
  }

  /**
   * A row as docs_document gives it, with the current version processed.
   */
  private function row(array $revisions): Row {
    $row = new Row(['source' => self::PAGE, 'revisions' => $revisions], ['source' => ['type' => 'string']]);
    foreach ([
      'uuid' => Identity::page(self::PAGE),
      'title' => 'Proxy',
      'field_description' => 'Route API calls through Nuxt.',
      'changed' => 1788528593,
      'revision_timestamp' => 1788528593,
      'revision_log' => 'fix(docs): post-merge polish (0e1a9dc)',
      'uid' => 1,
      'revision_uid' => 1,
      'field_content' => self::CURRENT,
    ] as $property => $value) {
      $row->setDestinationProperty($property, $value);
    }
    return $row;
  }

  /**
   * An earlier version as the IR carries it: some prose and an image.
   */
  private function version(string $sha, int $timestamp): array {
    return [
      'sha' => $sha,
      'date' => gmdate('Y-m-d\TH:i:s', $timestamp) . '+00:00',
      'subject' => 'docs: write the proxy guide',
      'path' => self::PAGE,
      'title' => 'Proxy at ' . substr($sha, 0, 7),
      'description' => NULL,
      'blocks' => [
        ['type' => 'text', 'markdown' => 'Proxy API calls.'],
        ['type' => 'image', 'src' => '/images/a.png', 'alt' => 'A'],
      ],
    ];
  }

  /**
   * The UUIDs of the paragraphs a field was given.
   *
   * @param list<\Drupal\Core\Entity\ContentEntityInterface> $paragraphs
   *   The paragraphs.
   */
  private function uuids(array $paragraphs): array {
    return array_map(static fn(ContentEntityInterface $paragraph): string => $paragraph->uuid(), $paragraphs);
  }

}
