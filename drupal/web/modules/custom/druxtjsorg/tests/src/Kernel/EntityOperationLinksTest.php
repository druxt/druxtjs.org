<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\node\NodeInterface;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;

/**
 * The operations an entity offers, as links on its JSON:API resource.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class EntityOperationLinksTest extends KernelTestBase {

  use UserCreationTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'node',
    'field',
    'text',
    'filter',
    'file',
    'serialization',
    'jsonapi',
    'jsonapi_hypermedia',
    'druxtjsorg',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('node');
    $this->installSchema('node', ['node_access']);
    $this->installConfig(['system', 'node', 'filter']);
    NodeType::create(['type' => 'page', 'name' => 'Page'])->save();
    // Uid 1 bypasses every access check, so it is spent here.
    $this->createUser();
    $this->container->get('router.builder')->rebuild();
  }

  /**
   * An editor is offered what Drupal would offer them on the entity.
   */
  public function testAnEditorGetsTheOperationsTheyMayUse(): void {
    $node = $this->node();
    $links = $this->links($node, [
      'access content',
      'edit any page content',
      'delete any page content',
      'view page revisions',
    ]);
    foreach (['edit-form' => 'edit', 'delete-form' => 'delete', 'version-history' => 'revisions'] as $key => $path) {
      self::assertArrayHasKey($key, $links, "Offered {$key}");
      self::assertStringEndsWith('/node/' . $node->id() . '/' . $path, $links[$key]['href']);
    }
    // JSON:API Hypermedia carries a link's attributes under meta.linkParams.
    self::assertSame('Edit', $links['edit-form']['meta']['linkParams']['title']);
  }

  /**
   * A reader is offered nothing.
   */
  public function testAReaderGetsNoOperations(): void {
    $links = $this->links($this->node(), ['access content']);
    self::assertArrayHasKey('self', $links);
    foreach (['edit-form', 'delete-form', 'version-history'] as $key) {
      self::assertArrayNotHasKey($key, $links, "Offered {$key}");
    }
  }

  /**
   * Each operation is checked on its own.
   */
  public function testEachOperationIsCheckedOnItsOwn(): void {
    $links = $this->links($this->node(), ['access content', 'edit any page content']);
    self::assertArrayHasKey('edit-form', $links);
    self::assertArrayNotHasKey('delete-form', $links);
  }

  /**
   * A published page.
   */
  private function node(): NodeInterface {
    $node = Node::create(['type' => 'page', 'title' => 'Hello', 'status' => 1]);
    $node->save();
    return $node;
  }

  /**
   * The resource object's links, as a user with these permissions sees them.
   */
  private function links(NodeInterface $node, array $permissions): array {
    $this->setCurrentUser($this->createUser($permissions));
    $request = Request::create('/jsonapi/node/page/' . $node->uuid());
    $request->headers->set('Accept', 'application/vnd.api+json');
    $response = $this->container->get('http_kernel')->handle($request);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    return json_decode((string) $response->getContent(), TRUE)['data']['links'];
  }

}
