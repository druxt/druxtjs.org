<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\KernelTests\KernelTestBase;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The deploy hook installs the paragraph Workspace field a copy lacks.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class ParagraphWorkspaceFieldUpdateTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'file',
    'serialization',
    'jsonapi',
    'jsonapi_hypermedia',
    'entity_reference_revisions',
    'paragraphs',
    'options',
    'workspaces',
    'workspaces_ui',
    'wse',
    'druxtjsorg',
  ];

  /**
   * A database without the column gets it, and a revision query then runs.
   */
  public function testTheUpdateInstallsTheField(): void {
    $this->installEntitySchema('user');
    $this->installEntitySchema('workspace');
    $this->installEntitySchema('paragraph');
    $this->container->get('module_handler')->loadInclude('druxtjsorg', 'php', 'druxtjsorg.deploy');

    $manager = $this->container->get('entity.definition_update_manager');
    $storage = $this->container->get('entity_type.manager')->getStorage('paragraph');
    // The site's hook runs before core's, so a fresh install declares the
    // field and installs it. The mapping names the table it lives in.
    $table = $storage->getTableMapping()->getFieldTableName('workspace');
    $schema = $this->container->get('database')->schema();
    self::assertTrue($schema->fieldExists($table, 'workspace'), 'a fresh install has the column');

    // A database copied from before paragraphs were tracked.
    $manager->uninstallFieldStorageDefinition($manager->getFieldStorageDefinition('workspace', 'paragraph'));
    self::assertFalse($schema->fieldExists($table, 'workspace'));
    self::assertNotEmpty($manager->getChangeSummary()['paragraph'] ?? [], 'core sees the field as missing');

    self::assertStringStartsWith('Installed', druxtjsorg_deploy_paragraph_workspace_field());

    self::assertTrue($schema->fieldExists($table, 'workspace'));
    self::assertEmpty($manager->getChangeSummary()['paragraph'] ?? []);
    // Running again on a database that has the column changes nothing.
    self::assertStringStartsWith('The paragraph Workspace field was already', druxtjsorg_deploy_paragraph_workspace_field());
    self::assertEmpty($manager->getChangeSummary()['paragraph'] ?? []);
    // The query that failed with "'workspace' not found" runs.
    self::assertSame([], $storage->getQuery()->allRevisions()->accessCheck(FALSE)->notExists('workspace')->execute());
  }

}
