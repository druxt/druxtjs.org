<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\druxt_docs\Identity;
use Drupal\druxt_docs\Plugin\migrate\destination\DocsPage;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\filter\Entity\FilterFormat;
use Drupal\KernelTests\KernelTestBase;
use Drupal\migrate\Row;
use Drupal\node\Entity\NodeType;
use Drupal\node\NodeInterface;
use Drupal\paragraphs\Entity\ParagraphsType;
use Drupal\user\Entity\User;
use Drupal\workflows\Entity\Workflow;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Every revision the importer writes is published under moderation.
 *
 * Moderation defaults a new page to draft and status follows the state, so a
 * destination that only set status would seed drafts. The import check counts
 * pages by existence and would not notice. This test hands the destination a
 * row that names no state, as a migration without the process key would, so
 * it proves the destination's own guarantee and not the row's.
 */
#[CoversClass(DocsPage::class)]
#[Group('druxt_docs')]
final class ImportedPageIsPublishedTest extends KernelTestBase {

  private const PAGE = 'docs/nuxt/content/how-to/proxy.md';
  private const FIRST = '77ab204cfc07b1b2b3b4b5b6b7b8b9babbbcbdbe';
  private const SECOND = 'be2195264b1bc1c2c3c4c5c6c7c8c9cacbcccdce';

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'filter',
    'text',
    'file',
    'node',
    'entity_reference_revisions',
    'paragraphs',
    'layout_discovery',
    'layout_paragraphs',
    'path_alias',
    'migrate',
    'workflows',
    'content_moderation',
    'druxt_docs',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('node');
    $this->installEntitySchema('paragraph');
    $this->installEntitySchema('content_moderation_state');
    $this->installSchema('node', ['node_access']);
    $this->installSchema('user', ['users_data']);
    $this->installConfig(['filter']);

    FilterFormat::create(['format' => 'docs_markdown', 'name' => 'Markdown'])->save();
    User::create(['uid' => 1, 'name' => 'importer'])->save();

    NodeType::create(['type' => 'doc_page', 'name' => 'Documentation page'])->save();
    FieldStorageConfig::create(['field_name' => 'field_description', 'entity_type' => 'node', 'type' => 'string_long'])->save();
    FieldConfig::create([
      'field_name' => 'field_description',
      'entity_type' => 'node',
      'bundle' => 'doc_page',
      'label' => 'Description',
    ])->save();
    foreach (['docs_layout_section' => NULL, 'docs_text' => 'field_text'] as $bundle => $field) {
      ParagraphsType::create(['id' => $bundle, 'label' => $bundle])->save();
      if ($field !== NULL) {
        FieldStorageConfig::create(['field_name' => $field, 'entity_type' => 'paragraph', 'type' => 'text_long'])->save();
        FieldConfig::create([
          'field_name' => $field,
          'entity_type' => 'paragraph',
          'bundle' => $bundle,
          'label' => 'Text',
        ])->save();
      }
    }
    FieldStorageConfig::create([
      'field_name' => 'field_content',
      'entity_type' => 'node',
      'type' => 'entity_reference_revisions',
      'cardinality' => FieldStorageConfig::CARDINALITY_UNLIMITED,
      'settings' => ['target_type' => 'paragraph'],
    ])->save();
    FieldConfig::create([
      'field_name' => 'field_content',
      'entity_type' => 'node',
      'bundle' => 'doc_page',
      'label' => 'Content',
      'settings' => ['handler' => 'default:paragraph'],
    ])->save();

    // The site's editorial workflow on this bundle, defaulting to draft.
    $workflow = Workflow::create(['id' => 'editorial', 'label' => 'Editorial', 'type' => 'content_moderation']);
    $type = $workflow->getTypePlugin();
    $configuration = $type->getConfiguration();
    $configuration['states']['archived'] = [
      'label' => 'Archived',
      'published' => FALSE,
      'default_revision' => TRUE,
      'weight' => 2,
    ];
    $configuration['default_moderation_state'] = 'draft';
    $configuration['entity_types'] = ['node' => ['doc_page']];
    $type->setConfiguration($configuration);
    $workflow->save();
  }

  /**
   * Two earlier versions and the current one, all published.
   */
  public function testEveryRevisionIsPublished(): void {
    $migration = $this->container->get('plugin.manager.migration')->createStubMigration([
      'id' => 'docs_page_published',
      'source' => ['plugin' => 'embedded_data', 'data_rows' => [], 'ids' => ['source' => ['type' => 'string']]],
      'process' => [],
      'destination' => ['plugin' => 'docs_page', 'default_bundle' => 'doc_page'],
    ]);
    $row = new Row(
      [
        'source' => self::PAGE,
        'revisions' => [$this->version(self::FIRST, 1636498122), $this->version(self::SECOND, 1652753961)],
      ],
      ['source' => ['type' => 'string']],
    );
    foreach ([
      'uuid' => Identity::page(self::PAGE),
      'title' => 'Proxy',
      'field_description' => 'Route API calls through Nuxt.',
      'changed' => 1788528593,
      'revision_timestamp' => 1788528593,
      'revision_log' => 'fix(docs): post-merge polish (0e1a9dc)',
      'uid' => 1,
      'revision_uid' => 1,
      'status' => 1,
      'field_content' => [],
    ] as $property => $value) {
      $row->setDestinationProperty($property, $value);
    }

    [$nid] = $migration->getDestinationPlugin()->import($row);

    $storage = $this->container->get('entity_type.manager')->getStorage('node');
    $node = $storage->load($nid);
    self::assertInstanceOf(NodeInterface::class, $node);
    self::assertTrue($node->isPublished());
    self::assertSame('published', $node->get('moderation_state')->value);

    $revision_ids = array_keys($storage->getQuery()->allRevisions()->condition('nid', $node->id())->accessCheck(FALSE)->execute());
    self::assertCount(3, $revision_ids, 'Two earlier versions and the current one.');
    foreach ($revision_ids as $vid) {
      $revision = $storage->loadRevision($vid);
      self::assertTrue($revision->isPublished(), "Revision $vid is published.");
      self::assertSame('published', $revision->get('moderation_state')->value, "Revision $vid is in the published state.");
    }
  }

  /**
   * One earlier version of the page, as the IR builder describes it.
   */
  private function version(string $sha, int $timestamp): array {
    return [
      'sha' => $sha,
      'date' => gmdate('Y-m-d\TH:i:s', $timestamp) . '+00:00',
      'subject' => 'docs: write the proxy guide',
      'path' => self::PAGE,
      'title' => 'Proxy at ' . substr($sha, 0, 7),
      'description' => NULL,
      'blocks' => [['type' => 'text', 'markdown' => 'Proxy API calls.']],
    ];
  }

}
