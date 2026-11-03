<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\PageCache\ChainRequestPolicy;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\path_alias\Entity\PathAlias;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\user\UserInterface;
use Drupal\workspaces\Entity\Workspace;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A live 404 is not served from Dynamic Page Cache inside a workspace.
 *
 * A page that exists only in a workspace answered "page not found" to its
 * editor once anyone with the same permissions had asked for its path on live.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class WorkspaceNotFoundCacheTest extends KernelTestBase {

  use UserCreationTrait;

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
    'image',
    'node',
    'serialization',
    'basic_auth',
    'path_alias',
    'decoupled_router',
    'dynamic_page_cache',
    'jsonapi',
    'workspaces',
    'druxtjsorg',
  ];

  /**
   * The password the test account signs in with.
   */
  private const PASSWORD = 'workspace-test-password';

  /**
   * The path that resolves only in the workspace.
   */
  private const PATH = '/router/translate-path?path=/staged-page&_format=json';

  /**
   * An account that may read content and view any workspace.
   */
  private UserInterface $editor;

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    parent::register($container);
    // The default policy refuses the command line, which would leave nothing
    // cached and let this test pass without the fix.
    $container->register('dynamic_page_cache_request_policy', ChainRequestPolicy::class);
  }

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('workspace');
    $this->installEntitySchema('path_alias');
    $this->installSchema('workspaces', ['workspace_association', 'workspace_association_revision']);
    $this->installEntitySchema('node');
    $this->installSchema('node', ['node_access']);
    $this->installConfig(['system', 'user', 'filter', 'node']);
    user_role_grant_permissions('anonymous', ['access content']);
    // Uid 1 bypasses every access check, so it is spent here.
    $this->createUser();

    NodeType::create(['type' => 'page', 'name' => 'Page'])->save();
    Workspace::create(['id' => 'stage', 'label' => 'Stage'])->save();
    $this->editor = $this->createUser(['access content', 'view any workspace']);
    $this->editor->setPassword(self::PASSWORD)->save();

    $this->container->get('workspaces.manager')->executeInWorkspace('stage', function () {
      $node = Node::create(['type' => 'page', 'title' => 'Staged', 'status' => 1]);
      $node->save();
      PathAlias::create(['path' => '/node/' . $node->id(), 'alias' => '/staged-page', 'langcode' => 'en'])->save();
    });
  }

  /**
   * A cached live 404 is not what the workspace gets.
   *
   * The bug showed as a HIT here. The status of this request isn't asserted:
   * alias lookups outlive a request in one process, as they don't in
   * production, so the next test checks the page resolves.
   */
  public function testALive404IsNotServedInTheWorkspace(): void {
    $live = $this->request(NULL);
    self::assertSame(404, $live->getStatusCode(), (string) $live->getContent());
    self::assertSame('MISS', $live->headers->get('X-Drupal-Dynamic-Cache'));
    self::assertSame('HIT', $this->request(NULL)->headers->get('X-Drupal-Dynamic-Cache'));

    self::assertSame('MISS', $this->request('stage')->headers->get('X-Drupal-Dynamic-Cache'));
  }

  /**
   * The workspace gets its page, and live doesn't get it afterwards.
   */
  public function testAWorkspacePageStaysInTheWorkspace(): void {
    $staged = $this->request('stage');
    self::assertSame(200, $staged->getStatusCode(), (string) $staged->getContent());

    // A 403 or a 404, depending on the lookups kept from the request above.
    self::assertNotSame(200, $this->request(NULL)->getStatusCode());
  }

  /**
   * Requests the path as the editor, on live or in a workspace.
   */
  private function request(?string $workspace): Response {
    $request = Request::create(self::PATH);
    $request->headers->set('PHP_AUTH_USER', $this->editor->getAccountName());
    $request->headers->set('PHP_AUTH_PW', self::PASSWORD);
    if ($workspace !== NULL) {
      $request->headers->set('X-Druxt-Workspace', $workspace);
    }
    // Each request negotiates its own workspace and account, as a fresh PHP
    // process would.
    $manager = $this->container->get('workspaces.manager');
    while (!property_exists($manager, 'activeWorkspace') && property_exists($manager, 'inner')) {
      $manager = (new \ReflectionProperty($manager, 'inner'))->getValue($manager);
    }
    (new \ReflectionProperty($manager, 'activeWorkspace'))->setValue($manager, NULL);
    $this->setCurrentUser(new AnonymousUserSession());
    $this->container->get('entity.memory_cache')->deleteAll();
    $this->container->get('path_alias.manager')->cacheClear();
    $response = $this->container->get('http_kernel')->handle($request);
    $this->container->get('http_kernel')->terminate($request, $response);
    return $response;
  }

}
