<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\workspaces\Entity\Workspace;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The deploy hook drops tracking rows left behind by an interrupted publish.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class PrunePublishedAssociationsTest extends KernelTestBase {

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
   * A row whose revision is live goes; a row for a pending revision stays.
   */
  public function testTheHookDropsOnlyLiveRows(): void {
    $this->installEntitySchema('user');
    $this->installEntitySchema('node');
    $this->installEntitySchema('workspace');
    $this->installSchema('node', ['node_access']);
    $this->installSchema('workspaces', ['workspace_association']);
    $this->installConfig(['node', 'workspaces']);
    $this->container->get('module_handler')->loadInclude('druxtjsorg', 'php', 'druxtjsorg.deploy');
    NodeType::create(['type' => 'page', 'name' => 'Page'])->save();
    $workspace = Workspace::create(['id' => 'stage', 'label' => 'Stage']);
    $workspace->save();

    // A page whose tracked revision became live, as after a publish whose
    // cleanup never ran.
    $live = Node::create(['type' => 'page', 'title' => 'Live']);
    $live->save();
    // A page with a pending revision still in the workspace.
    $pending = Node::create(['type' => 'page', 'title' => 'Pending']);
    $pending->save();
    $pending->setNewRevision();
    $pending->isDefaultRevision(FALSE);
    $pending->save();
    $database = $this->container->get('database');
    foreach ([[$live, $live->getRevisionId()], [$pending, $pending->getRevisionId()]] as [$node, $vid]) {
      $database->insert('workspace_association')->fields([
        'workspace' => 'stage',
        'target_entity_type_id' => 'node',
        'target_entity_id' => $node->id(),
        'target_entity_id_string' => (string) $node->id(),
        'target_entity_revision_id' => $vid,
      ])->execute();
    }
    $count = fn () => (int) $database->select('workspace_association')->countQuery()->execute()->fetchField();
    self::assertSame(2, $count());

    self::assertStringStartsWith('Dropped 1', druxtjsorg_deploy_prune_published_associations());
    self::assertSame(1, $count());
    $left = $database->select('workspace_association', 'wa')->fields('wa', ['target_entity_id'])->execute()->fetchField();
    self::assertSame((int) $pending->id(), (int) $left, 'the pending revision stays tracked');
    self::assertStringStartsWith('No workspace tracking row', druxtjsorg_deploy_prune_published_associations());
  }

}
