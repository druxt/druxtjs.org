<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\Component\Serialization\Yaml;
use Drupal\druxt_docs\History;
use Drupal\druxt_docs\Identity;
use Drupal\druxt_docs\Layout;
use Drupal\druxt_docs\Plugin\migrate\source\DocsBlock;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Group;

/**
 * What a page's earlier versions become: dated, logged, with paragraphs.
 */
#[CoversClass(History::class)]
#[Group('druxt_docs')]
final class HistoryTest extends UnitTestCase {

  private const PAGE = 'docs/nuxt/content/how-to/proxy.md';

  private const SHA = 'ad2ea458ca4c0000000000000000000000000000';

  /**
   * A revision's log is its commit's subject and short sha.
   */
  public function testTheLogIsTheSubjectAndShortSha(): void {
    self::assertSame('docs(how-to): rewrite the proxy guide (#807) (ad2ea45)', History::log('docs(how-to): rewrite the proxy guide (#807)', self::SHA));
    self::assertSame('(ad2ea45)', History::log('', self::SHA));
  }

  /**
   * A sha that is not a full one names no commit for certain.
   */
  public function testTheLogRefusesAShortSha(): void {
    $this->expectException(\InvalidArgumentException::class);
    History::log('subject', 'ad2ea45');
  }

  /**
   * The dates the builder writes, in any offset, are the second they name.
   */
  public function testReadsTheDatesTheBuilderWrites(): void {
    self::assertSame(1667435566, History::timestamp('2022-11-03T00:32:46+00:00'));
    self::assertSame(1636498122, History::timestamp('2021-11-10T09:48:42+11:00'));
  }

  /**
   * Any other date is refused rather than read as something close to it.
   */
  #[DataProvider('notDates')]
  public function testRefusesAnyOtherDate(string $date): void {
    $this->expectException(\InvalidArgumentException::class);
    History::timestamp($date);
  }

  /**
   * Dates the builder never writes.
   */
  public static function notDates(): array {
    return [
      'Z for UTC' => ['2022-11-03T00:32:46Z'],
      'no time' => ['2022-11-03'],
      'a day that does not exist' => ['2021-02-30T00:00:00+00:00'],
      'epoch seconds' => ['1667435566'],
    ];
  }

  /**
   * A version comes back dated, logged and otherwise as the IR gave it.
   */
  public function testVersionsAreCheckedAndConverted(): void {
    self::assertSame([
      [
        'sha' => self::SHA,
        'timestamp' => 1788520148,
        'log' => 'docs(how-to): rewrite the proxy guide (#807) (ad2ea45)',
        'title' => 'Proxy',
        'description' => NULL,
        'blocks' => [['type' => 'text', 'markdown' => 'Hello.']],
      ],
    ], History::versions([self::revision()], self::PAGE));
  }

  /**
   * A page with one version has no earlier ones, which is not an error.
   */
  public function testNoEarlierVersionsIsNoHistory(): void {
    self::assertSame([], History::versions([], self::PAGE));
  }

  /**
   * A malformed version stops the run, and names the page and the commit.
   */
  #[DataProvider('malformed')]
  public function testAMalformedVersionIsRefusedByName(mixed $revisions, string $message): void {
    $this->expectException(\InvalidArgumentException::class);
    $this->expectExceptionMessageMatches($message);
    History::versions($revisions, self::PAGE);
  }

  /**
   * Versions a builder bug or a hand edit could produce.
   */
  public static function malformed(): array {
    $revision = self::revision();
    return [
      'not a list' => [['first' => $revision], '/proxy\.md: "revisions" is not a list/'],
      'no revisions at all' => [NULL, '/is not a list/'],
      'a short sha' => [[self::revision(['sha' => 'ad2ea45'])], '/proxy\.md: earlier version 0 names no full commit sha/'],
      'the same commit twice' => [[$revision, $revision], '/at ad2ea458ca4c: two earlier versions come from the same commit/'],
      'no date' => [[self::revision(['date' => NULL])], '/at ad2ea458ca4c: no date/'],
      'a date in another form' => [[self::revision(['date' => '2026-09-04T11:09:08Z'])], '/at ad2ea458ca4c: .* is not a date/'],
      'no subject' => [[self::revision(['subject' => NULL])], '/no subject/'],
      'no title' => [[self::revision(['title' => NULL])], '/no title/'],
      'an empty title' => [[self::revision(['title' => ' '])], '/an empty title/'],
      'no blocks' => [[self::revision(['blocks' => []])], '/no blocks/'],
      'a description that is not text' => [[self::revision(['description' => 7])], '/description/'],
    ];
  }

  /**
   * A section, its blocks, the next section: the order the field is read in.
   *
   * The deployment-models page's shape, with its row of three diagrams.
   */
  public function testParagraphsFollowTheLayout(): void {
    $paragraphs = History::paragraphs(self::PAGE, self::SHA, [
      ['type' => 'text', 'markdown' => 'Before.'],
      ['type' => 'diagram', 'source' => 'flowchart TB', 'syntax' => 'mermaid', 'group' => 'group-1'],
      ['type' => 'diagram', 'source' => 'flowchart LR', 'syntax' => 'mermaid', 'group' => 'group-1'],
      ['type' => 'diagram', 'source' => 'flowchart RL', 'syntax' => 'mermaid', 'group' => 'group-1'],
      ['type' => 'text', 'markdown' => 'After.'],
    ], static fn(): int => throw new \LogicException('This version has no images.'));

    self::assertSame(
      ['docs_layout_section', 'docs_text', 'docs_layout_section', 'docs_diagram', 'docs_diagram', 'docs_diagram', 'docs_layout_section', 'docs_text'],
      array_column($paragraphs, 'type'),
    );
    self::assertSame([
      Identity::revisionSectionParagraph(self::PAGE, self::SHA, 0),
      Identity::revisionParagraph(self::PAGE, self::SHA, 0),
      Identity::revisionSectionParagraph(self::PAGE, self::SHA, 1),
      Identity::revisionParagraph(self::PAGE, self::SHA, 1),
      Identity::revisionParagraph(self::PAGE, self::SHA, 2),
      Identity::revisionParagraph(self::PAGE, self::SHA, 3),
      Identity::revisionSectionParagraph(self::PAGE, self::SHA, 2),
      Identity::revisionParagraph(self::PAGE, self::SHA, 4),
    ], array_column($paragraphs, 'uuid'));

    self::assertSame(Layout::sectionBehavior('layout_threecol_33_34_33'), unserialize($paragraphs[2]['behavior_settings']));
    foreach (['first', 'second', 'third'] as $offset => $region) {
      self::assertSame(
        Layout::blockBehavior($paragraphs[2]['uuid'], $region),
        unserialize($paragraphs[3 + $offset]['behavior_settings']),
        'Each diagram sits in its own version\'s section, in its column.',
      );
    }
  }

  /**
   * Each block gets the fields its paragraph migration writes.
   */
  public function testEachBlockGetsItsFields(): void {
    $looked_up = [];
    $paragraphs = History::paragraphs(self::PAGE, self::SHA, [
      ['type' => 'text', 'markdown' => 'Prose.'],
      ['type' => 'code', 'code' => 'npm run dev', 'language' => 'sh'],
      ['type' => 'callout', 'callout' => 'prerequisite', 'markdown' => '> **Before you start:** install.'],
      ['type' => 'image', 'src' => '/images/a.png', 'alt' => 'A'],
      ['type' => 'diagram', 'source' => 'flowchart TB', 'syntax' => 'mermaid'],
    ], static function (string $src) use (&$looked_up): int {
      $looked_up[] = $src;
      return 42;
    });
    $blocks = array_values(array_filter($paragraphs, static fn(array $paragraph): bool => $paragraph['type'] !== 'docs_layout_section'));

    self::assertSame(['value' => 'Prose.', 'format' => 'docs_markdown'], $blocks[0]['field_text']);
    self::assertSame(['npm run dev', 'sh'], [$blocks[1]['field_code'], $blocks[1]['field_language']]);
    self::assertSame(['value' => '> **Before you start:** install.', 'format' => 'docs_markdown'], $blocks[2]['field_callout']);
    self::assertSame('prerequisite', $blocks[2]['field_callout_type']);
    self::assertSame(['target_id' => 42], $blocks[3]['field_media']);
    self::assertSame(['/images/a.png'], $looked_up, 'An image points at the media its path was migrated to.');
    self::assertSame(['flowchart TB', 'mermaid', NULL], [$blocks[4]['field_diagram'], $blocks[4]['field_syntax'], $blocks[4]['field_group']]);
    self::assertSame(['en'], array_values(array_unique(array_column($paragraphs, 'langcode'))));
  }

  /**
   * History writes the fields each paragraph migration writes, and no more.
   *
   * One mapping, written twice: once in each migration's YAML and once
   * here. This is what notices when a migration gains a field and the
   * history does not.
   */
  public function testFieldsMatchTheParagraphMigrations(): void {
    $samples = [
      'text' => ['type' => 'text', 'markdown' => 'x'],
      'code' => ['type' => 'code', 'code' => 'x', 'language' => 'js'],
      'diagram' => ['type' => 'diagram', 'source' => 'x', 'syntax' => 'mermaid', 'group' => 'g'],
      'callout' => ['type' => 'callout', 'callout' => 'prerequisite', 'markdown' => 'x'],
      'image' => ['type' => 'image', 'src' => '/x.png', 'alt' => 'x'],
    ];
    self::assertSame(array_keys(DocsBlock::BUNDLES), array_keys($samples), 'Every block type is sampled.');

    $config = dirname(__DIR__, 7) . '/config/sync';
    foreach ($samples as $type => $block) {
      $migration = Yaml::decode((string) file_get_contents("$config/migrate_plus.migration.docs_paragraph_$type.yml"));
      $fields = [];
      foreach ($migration['process'] as $property => $process) {
        [$field] = explode('/', $property);
        if (str_starts_with($field, 'field_')) {
          $fields[$field] = $field;
        }
        if (str_ends_with($property, '/format')) {
          self::assertSame($process['default_value'], History::TEXT_FORMAT, "docs_paragraph_$type stores prose in the format history does.");
        }
      }
      $paragraph = History::paragraphs(self::PAGE, self::SHA, [$block], static fn(): int => 1)[1];
      $written = array_values(array_filter(array_keys($paragraph), static fn(string $key): bool => str_starts_with($key, 'field_')));

      self::assertEqualsCanonicalizing(array_values($fields), $written, "History writes the fields docs_paragraph_$type writes.");
      self::assertSame($migration['destination']['default_bundle'], $paragraph['type']);
      self::assertSame($migration['process']['langcode']['default_value'], $paragraph['langcode']);
    }
  }

  /**
   * A block this site does not model stops the run rather than vanishing.
   */
  public function testAnUnmodelledBlockFails(): void {
    $this->expectException(\InvalidArgumentException::class);
    $this->expectExceptionMessageMatches('/block 0: "table" is not a block type/');
    History::paragraphs(self::PAGE, self::SHA, [['type' => 'table']], static fn(): int => 1);
  }

  /**
   * An earlier version as the IR carries it.
   */
  private static function revision(array $overrides = []): array {
    return $overrides + [
      'sha' => self::SHA,
      'date' => '2026-09-04T11:09:08+00:00',
      'subject' => 'docs(how-to): rewrite the proxy guide (#807)',
      'path' => self::PAGE,
      'title' => 'Proxy',
      'description' => NULL,
      'blocks' => [['type' => 'text', 'markdown' => 'Hello.']],
    ];
  }

}
