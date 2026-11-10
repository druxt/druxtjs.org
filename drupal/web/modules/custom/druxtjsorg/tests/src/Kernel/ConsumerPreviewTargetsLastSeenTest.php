<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\KernelTests\KernelTestBase;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The deploy hook adds the last seen column a site's stored targets lack.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class ConsumerPreviewTargetsLastSeenTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'file',
    'image',
    'node',
    'serialization',
    'jsonapi',
    'jsonapi_hypermedia',
    'entity_reference_revisions',
    'paragraphs',
    'options',
    'workspaces',
    'workspaces_ui',
    'wse',
    'consumers',
    'jsonapi_node_preview',
    'consumer_node_preview',
    'druxtjsorg',
  ];

  /**
   * A table with targets and no last seen column gets the column, rows kept.
   */
  public function testTheHookAddsTheColumnWithTheRowsKept(): void {
    $this->installEntitySchema('user');
    $this->installEntitySchema('workspace');
    $this->installEntitySchema('consumer');
    $this->container->get('module_handler')->loadInclude('druxtjsorg', 'php', 'druxtjsorg.deploy');
    $manager = $this->container->get('entity.definition_update_manager');
    $storage = $this->container->get('entity_type.manager')->getStorage('consumer');
    $table = $storage->getTableMapping()->getFieldTableName('preview_targets');
    $definition = $manager->getFieldStorageDefinition('preview_targets', 'consumer');
    $column = $storage->getTableMapping()->getFieldColumnName($definition, 'last_seen');
    $schema = $this->container->get('database')->schema();
    self::assertTrue($schema->fieldExists($table, $column), 'a fresh install has the column');
    self::assertStringStartsWith('The preview targets columns were already', druxtjsorg_deploy_preview_targets_last_seen());

    // A consumer with a target, as a site that registers its frontend has.
    $consumer = $storage->create([
      'client_id' => 'frontend',
      'label' => 'Frontend',
      'preview_targets' => [
        [
          'label' => 'druxtjs.org',
          'url' => 'https://druxtjs.org/druxt/node/preview#[jsonapi_node_preview_path]',
        ],
      ],
    ]);
    $consumer->save();

    // The database as an earlier copy of the module left it: no column, and
    // no column in the schema Drupal recorded for the field.
    $schema->dropField($table, $column);
    $key_value = $this->container->get('keyvalue')->get('entity.storage_schema.sql');
    $stored = $key_value->get('consumer.field_schema_data.preview_targets');
    unset($stored[$table]['fields'][$column]);
    $key_value->set('consumer.field_schema_data.preview_targets', $stored);
    self::assertNotEmpty($manager->getChangeSummary()['consumer'] ?? [], 'core sees the field as changed');

    self::assertSame("Added $table.$column.", druxtjsorg_deploy_preview_targets_last_seen());
    self::assertTrue($schema->fieldExists($table, $column));
    self::assertEmpty($manager->getChangeSummary()['consumer'] ?? [], 'core sees nothing left to change');
    $targets = $storage->loadUnchanged($consumer->id())->get('preview_targets')->getValue();
    self::assertSame('druxtjs.org', $targets[0]['label']);
    self::assertNull($targets[0]['last_seen'] ?? NULL);

    // A target saves with its last seen time now.
    $consumer = $storage->loadUnchanged($consumer->id());
    $consumer->get('preview_targets')->appendItem([
      'label' => 'Test',
      'url' => 'https://test.trycloudflare.com/druxt/node/preview#[jsonapi_node_preview_path]',
      'last_seen' => 1794300000,
    ]);
    $consumer->save();
    self::assertSame(1794300000, (int) $storage->loadUnchanged($consumer->id())->get('preview_targets')->get(1)->get('last_seen')->getValue());
    self::assertStringStartsWith('The preview targets columns were already', druxtjsorg_deploy_preview_targets_last_seen());
  }

}
