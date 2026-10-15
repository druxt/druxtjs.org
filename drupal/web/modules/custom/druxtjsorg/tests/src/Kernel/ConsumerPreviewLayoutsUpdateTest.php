<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\KernelTests\KernelTestBase;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The deploy hook installs the consumer preview layouts field a copy lacks.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class ConsumerPreviewLayoutsUpdateTest extends KernelTestBase {

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
   * A database without the table gets it, and running again changes nothing.
   */
  public function testTheHookInstallsTheField(): void {
    $this->installEntitySchema('user');
    $this->installEntitySchema('workspace');
    $this->installEntitySchema('consumer');
    $this->container->get('module_handler')->loadInclude('druxtjsorg', 'php', 'druxtjsorg.deploy');
    $manager = $this->container->get('entity.definition_update_manager');
    $storage = $this->container->get('entity_type.manager')->getStorage('consumer');
    // A fresh install declares the field and installs it with the entity.
    $table = $storage->getTableMapping()->getFieldTableName('preview_layouts');
    $schema = $this->container->get('database')->schema();
    self::assertTrue($schema->tableExists($table), 'a fresh install has the field table');
    self::assertStringStartsWith('The consumer preview layouts field was already', druxtjsorg_deploy_consumer_preview_layouts());
    // A database that ran the earlier copy without its update hook.
    $manager->uninstallFieldStorageDefinition($manager->getFieldStorageDefinition('preview_layouts', 'consumer'));
    self::assertFalse($schema->tableExists($table));
    self::assertNotEmpty($manager->getChangeSummary()['consumer'] ?? [], 'core sees the field as missing');
    self::assertStringStartsWith('Installed', druxtjsorg_deploy_consumer_preview_layouts());
    self::assertTrue($schema->tableExists($table));
    self::assertEmpty($manager->getChangeSummary()['consumer'] ?? []);
    // Running again on a database that has the table changes nothing.
    self::assertStringStartsWith('The consumer preview layouts field was already', druxtjsorg_deploy_consumer_preview_layouts());
  }

}
