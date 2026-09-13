<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\destination;

use Drupal\Core\Database\Connection;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityFieldManagerInterface;
use Drupal\Core\Entity\EntityStorageInterface;
use Drupal\Core\Entity\EntityTypeBundleInfoInterface;
use Drupal\Core\Entity\RevisionableStorageInterface;
use Drupal\Core\Field\FieldTypePluginManagerInterface;
use Drupal\Core\Session\AccountSwitcherInterface;
use Drupal\druxt_docs\History;
use Drupal\migrate\Attribute\MigrateDestination;
use Drupal\migrate\MigrateException;
use Drupal\migrate\MigrateLookupInterface;
use Drupal\migrate\Plugin\migrate\destination\EntityContentBase;
use Drupal\migrate\Plugin\MigrationInterface;
use Drupal\migrate\Row;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * A documentation page, with its git history saved as dated revisions.
 *
 * The node destination, plus one thing. When it creates a page, it first
 * saves each of the page's earlier versions as a revision, oldest first,
 * dated to its commit, logged with the commit's subject and short sha, and
 * holding new paragraphs of its own. The current version then goes through
 * the node destination as it always has, as the last revision and the
 * default one. An update never touches history: a page is given its history
 * once, when it is created, so a re-run with --update cannot write it twice.
 *
 * The page's source path is its row's "source" and its earlier versions its
 * row's "revisions", as the docs_document source gives them.
 *
 * Core's entity_complete destination is deprecated with no replacement, so
 * this extends the node destination rather than that.
 *
 * @code
 * destination:
 *   plugin: docs_page
 *   default_bundle: doc_page
 *   media_migration: docs_media
 * @endcode
 */
#[MigrateDestination(id: 'docs_page')]
final class DocsPage extends EntityContentBase {

  /**
   * The fields that differ from one version of a page to the next.
   *
   * Every other field belongs to the page rather than to a version, and each
   * revision carries its current value. The table of contents is computed
   * from each revision's own blocks, so it is not written here.
   */
  private const VERSIONED = [
    'title',
    'field_description',
    'field_content',
    'changed',
    'revision_timestamp',
    'revision_log',
  ];

  /**
   * The earlier versions of the page being imported, oldest first.
   *
   * @var list<array>
   */
  private array $history = [];

  /**
   * The source path of the page being imported.
   */
  private string $page = '';

  public function __construct(
    array $configuration,
    $plugin_id,
    $plugin_definition,
    MigrationInterface $migration,
    EntityStorageInterface $storage,
    array $bundles,
    EntityFieldManagerInterface $entity_field_manager,
    FieldTypePluginManagerInterface $field_type_manager,
    AccountSwitcherInterface $account_switcher,
    EntityTypeBundleInfoInterface $entity_type_bundle_info,
    private readonly EntityStorageInterface $paragraphStorage,
    private readonly MigrateLookupInterface $migrateLookup,
    private readonly Connection $database,
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition, $migration, $storage, $bundles, $entity_field_manager, $field_type_manager, $account_switcher, $entity_type_bundle_info);
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition, ?MigrationInterface $migration = NULL) {
    $entity_type_manager = $container->get('entity_type.manager');
    return new static(
      $configuration,
      $plugin_id,
      $plugin_definition,
      $migration,
      $entity_type_manager->getStorage('node'),
      array_keys($container->get('entity_type.bundle.info')->getBundleInfo('node')),
      $container->get('entity_field.manager'),
      $container->get('plugin.manager.field.field_type'),
      $container->get('account_switcher'),
      $container->get('entity_type.bundle.info'),
      $entity_type_manager->getStorage('paragraph'),
      $container->get('migrate.lookup'),
      $container->get('database'),
    );
  }

  /**
   * {@inheritdoc}
   */
  protected static function getEntityTypeId($plugin_id) {
    return 'node';
  }

  /**
   * {@inheritdoc}
   */
  public function import(Row $row, array $old_destination_id_values = []) {
    $this->page = (string) $row->getSourceProperty('source');
    try {
      $this->history = History::versions($row->getSourceProperty('revisions'), $this->page);
    }
    catch (\InvalidArgumentException $exception) {
      throw new MigrateException($exception->getMessage());
    }
    try {
      return parent::import($row, $old_destination_id_values);
    }
    finally {
      $this->history = [];
      $this->page = '';
    }
  }

  /**
   * {@inheritdoc}
   */
  protected function save(ContentEntityInterface $entity, array $old_destination_id_values = []) {
    if (!$entity->isNew() || $this->history === []) {
      return parent::save($entity, $old_destination_id_values);
    }

    // One transaction, so a failure part way through leaves no half-written
    // page behind for the next run to trip over.
    $transaction = $this->database->startTransaction();
    try {
      $current = [];
      foreach (self::VERSIONED as $field) {
        $current[$field] = $entity->get($field)->getValue();
      }

      foreach ($this->history as $number => $version) {
        $entity->set('title', $version['title']);
        $entity->set('field_description', $version['description']);
        $entity->set('field_content', $this->paragraphs($version));
        $entity->set('changed', $version['timestamp']);
        $entity->set('revision_timestamp', $version['timestamp']);
        $entity->set('revision_log', $version['log']);
        if ($number > 0) {
          $entity->setNewRevision(TRUE);
        }
        $entity->setSyncing(TRUE);
        $entity->save();
      }

      // The current version, saved as a new revision without its paragraphs
      // and then given them in place. A new revision of a page makes
      // entity_reference_revisions copy every paragraph it already refers to
      // into a new paragraph revision, and the paragraph migrations would
      // then hold a revision that is no longer the paragraph's default,
      // which their rollback deletes as a revision rather than a paragraph.
      foreach ($current as $field => $value) {
        $entity->set($field, $value);
      }
      $entity->set('field_content', []);
      $entity->setNewRevision(TRUE);
      $entity->setSyncing(TRUE);
      $entity->save();
      $entity->set('field_content', $current['field_content']);
      return parent::save($entity, $old_destination_id_values);
    }
    catch (\Throwable $exception) {
      $transaction->rollBack();
      // The storages may still cache what the transaction just undid.
      $this->storage->resetCache();
      $this->paragraphStorage->resetCache();
      throw $exception;
    }
  }

  /**
   * {@inheritdoc}
   */
  public function rollback(array $destination_identifier) {
    $node = $this->storage->load(reset($destination_identifier));
    $earlier = $node instanceof ContentEntityInterface ? $this->earlierParagraphs($node) : [];
    parent::rollback($destination_identifier);
    if ($earlier !== []) {
      $this->paragraphStorage->delete($this->paragraphStorage->loadMultiple($earlier));
    }
  }

  /**
   * New, unsaved paragraphs for one earlier version.
   *
   * Unsaved, so that entity_reference_revisions saves each one as it saves
   * the revision that holds it. A saved paragraph would be copied into a
   * second revision instead, one no page refers to.
   *
   * @return list<\Drupal\Core\Entity\ContentEntityInterface>
   *   The paragraphs, in the order the page's field holds them.
   */
  private function paragraphs(array $version): array {
    $sha = $version['sha'];
    try {
      $values = History::paragraphs($this->page, $sha, $version['blocks'], fn(string $src): int|string => $this->media($src, $sha));
    }
    catch (\InvalidArgumentException $exception) {
      throw new MigrateException(sprintf('%s at %s: %s', $this->page, substr($sha, 0, 12), $exception->getMessage()));
    }
    return array_map(
      fn(array $value) => $this->paragraphStorage->create($value + ['created' => $version['timestamp']]),
      $values,
    );
  }

  /**
   * The media entity today's image migration made for an image path.
   *
   * The builder only lets an earlier version keep an image that today's
   * corpus migrates, with the same alt text, so one missing here means the
   * image migration has not run.
   */
  private function media(string $src, string $sha): int|string {
    $migration = $this->configuration['media_migration'] ?? 'docs_media';
    $ids = $this->migrateLookup->lookup($migration, [$src]);
    $first = $ids === [] ? NULL : reset($ids);
    $id = is_array($first) ? reset($first) : NULL;
    if ($id === NULL || $id === FALSE) {
      throw new MigrateException(sprintf('%s at %s: %s has no media in %s. Run it first.', $this->page, substr($sha, 0, 12), $src, $migration));
    }
    return $id;
  }

  /**
   * The paragraphs only a page's earlier revisions refer to.
   *
   * Deleting a page deletes none of them: entity_reference_revisions only
   * queues the current revision's paragraphs for its orphan purger. Those
   * current ones belong to the paragraph migrations, whose own rollback
   * deletes them, so they are left out here, and a page rolled back on its
   * own finds the paragraphs its migrations recorded when it comes back.
   *
   * @return list<int|string>
   *   Paragraph IDs.
   */
  private function earlierParagraphs(ContentEntityInterface $node): array {
    if (!$this->storage instanceof RevisionableStorageInterface) {
      return [];
    }
    $current = array_column($node->get('field_content')->getValue(), 'target_id');
    $revision_ids = array_keys($this->storage->getQuery()
      ->allRevisions()
      ->accessCheck(FALSE)
      ->condition($this->getKey('id'), $node->id())
      ->execute());
    $referenced = [];
    foreach ($this->storage->loadMultipleRevisions($revision_ids) as $revision) {
      foreach ($revision->get('field_content')->getValue() as $item) {
        $referenced[] = $item['target_id'];
      }
    }
    return array_values(array_diff(array_unique($referenced), $current));
  }

}
