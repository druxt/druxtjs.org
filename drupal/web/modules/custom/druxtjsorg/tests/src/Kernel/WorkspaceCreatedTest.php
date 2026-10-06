<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\druxtjsorg\Controller\WorkspaceChangesController;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\workspaces\Entity\Workspace;
use Drupal\workspaces\WorkspaceInterface;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Which pages a workspace created, as opposed to edited.
 */
#[CoversClass(WorkspaceChangesController::class)]
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class WorkspaceCreatedTest extends KernelTestBase {

  use UserCreationTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'file',
    'field',
    'filter',
    'text',
    'node',
    'serialization',
    'jsonapi',
    'jsonapi_hypermedia',
    'workspaces',
    'druxtjsorg',
  ];

  /**
   * The workspace content is staged in.
   */
  private WorkspaceInterface $stage;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('workspace');
    $this->installSchema('workspaces', ['workspace_association', 'workspace_association_revision']);
    $this->installEntitySchema('node');
    $this->installSchema('node', ['node_access']);
    $this->installConfig(['system', 'user', 'filter', 'node']);
    $this->setCurrentUser($this->createUser([], NULL, TRUE));
    NodeType::create(['type' => 'doc_page', 'name' => 'Documentation page'])->save();
    $this->stage = Workspace::create(['id' => 'stage', 'label' => 'Stage']);
    $this->stage->save();
  }

  /**
   * A page made in the workspace is listed; one edited there is not.
   */
  public function testListsOnlyThePagesTheWorkspaceCreated(): void {
    $edited = Node::create(['type' => 'doc_page', 'title' => 'On live', 'status' => 1]);
    $edited->save();

    $created = $this->container->get('workspaces.manager')->executeInWorkspace('stage', function () use ($edited): Node {
      $edited->setTitle('On live, edited in Stage')->save();
      $page = Node::create(['type' => 'doc_page', 'title' => 'Made in Stage', 'status' => 1]);
      $page->save();
      return $page;
    });

    self::assertSame([$created->uuid()], $this->created($this->stage));
  }

  /**
   * A workspace that has created nothing lists nothing.
   */
  public function testAnEmptyWorkspaceListsNothing(): void {
    self::assertSame([], $this->created($this->stage));
  }

  /**
   * The route reads the workspace and is gated on viewing it.
   */
  public function testTheRouteIsGatedOnViewingTheWorkspace(): void {
    $route = $this->container->get('router.route_provider')->getRouteByName('druxtjsorg.workspace_created');
    self::assertSame('/druxt-docs/workspace/{workspace}/created', $route->getPath());
    self::assertSame('workspace.view', $route->getRequirement('_entity_access'));
    self::assertSame(['GET'], $route->getMethods());
  }

  /**
   * The controller's answer for a workspace.
   *
   * @return string[]
   *   The uuids it lists.
   */
  private function created(WorkspaceInterface $workspace): array {
    $controller = WorkspaceChangesController::create($this->container);
    return json_decode((string) $controller->created($workspace)->getContent(), TRUE)['data'];
  }

}
