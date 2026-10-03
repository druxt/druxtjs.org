<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\Component\Serialization\Json;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\druxtjsorg\Controller\WorkspaceEntityResource;
use Drupal\druxtjsorg\EventSubscriber\WorkspaceHeaderSubscriber;
use Drupal\druxtjsorg\Hook\WorkspaceCacheHooks;
use Drupal\druxtjsorg\Revisions\LiveWorkingCopy;
use Drupal\druxtjsorg\Revisions\WorkspaceVersionNegotiator;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\node\NodeInterface;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\user\UserInterface;
use Drupal\workspaces\Entity\Workspace;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\HttpKernelInterface;

/**
 * JSON:API reads and writes in the workspace a request header names.
 */
#[CoversClass(WorkspaceHeaderSubscriber::class)]
#[CoversClass(WorkspaceEntityResource::class)]
#[CoversClass(WorkspaceCacheHooks::class)]
#[CoversClass(LiveWorkingCopy::class)]
#[CoversClass(WorkspaceVersionNegotiator::class)]
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class WorkspaceJsonapiTest extends KernelTestBase {

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
    'node',
    'serialization',
    'basic_auth',
    'jsonapi',
    'jsonapi_hypermedia',
    'workspaces',
    'druxtjsorg',
  ];

  /**
   * The password every test account signs in with.
   */
  private const PASSWORD = 'workspace-test-password';

  /**
   * The page the requests read and write.
   */
  private NodeInterface $page;

  /**
   * An account that may edit pages, read their revisions and view any workspace.
   */
  private UserInterface $editor;

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
    $this->installConfig(['system', 'user', 'filter', 'node', 'jsonapi']);
    $this->config('jsonapi.settings')->set('read_only', FALSE)->save();
    user_role_grant_permissions('anonymous', ['access content']);
    // Uid 1 bypasses every access check, so it is spent here.
    $this->createUser();

    NodeType::create(['type' => 'page', 'name' => 'Page'])->save();
    Workspace::create(['id' => 'stage', 'label' => 'Stage'])->save();
    $this->page = Node::create(['type' => 'page', 'title' => 'Live title', 'status' => 1]);
    $this->page->save();

    $this->editor = $this->createUser(['access content', 'edit any page content', 'view page revisions', 'view any workspace'], 'editor');
    $this->editor->setPassword(self::PASSWORD)->save();
  }

  /**
   * Two writes in a row land in the workspace, and live keeps its title.
   */
  public function testRepeatedWritesStayInTheWorkspace(): void {
    self::assertSame(200, $this->patch('First staged title', 'stage')->getStatusCode());
    $second = $this->patch('Second staged title', 'stage');
    self::assertSame(200, $second->getStatusCode(), (string) $second->getContent());

    self::assertSame('Live title', $this->liveTitle());
    self::assertSame('Second staged title', $this->title($this->editor, 'stage'));
    self::assertSame('Live title', $this->title($this->editor));
    self::assertSame('Live title', $this->title(NULL, 'stage'));
  }

  /**
   * Reads in and out of the workspace never answer from each other's cache.
   */
  public function testWorkspaceAndLiveReadsDoNotShareCachedNormalizations(): void {
    $this->patch('Staged title', 'stage');

    self::assertSame('Live title', $this->title($this->editor));
    self::assertSame('Staged title', $this->title($this->editor, 'stage'));
    self::assertSame('Live title', $this->title($this->editor));
    self::assertSame('Live title', $this->title(NULL));
  }

  /**
   * On live the working copy is live's own, never the workspace's revision.
   */
  public function testTheLiveWorkingCopyLeavesTheWorkspaceOut(): void {
    $this->patch('Staged title', 'stage');

    self::assertSame('Live title', $this->title($this->editor, NULL, 'rel:working-copy'));
    self::assertSame('Staged title', $this->title($this->editor, 'stage', 'rel:working-copy'));
  }

  /**
   * A write naming a workspace the account cannot have is refused whole.
   */
  public function testAWriteToAnUnavailableWorkspaceIsRefused(): void {
    $other = $this->createUser(['access content', 'edit any page content'], 'other');
    $other->setPassword(self::PASSWORD)->save();

    self::assertSame(403, $this->patch('Nowhere', 'nothing_here')->getStatusCode());
    self::assertSame(403, $this->patch('Nowhere', 'stage', $other)->getStatusCode());
    self::assertSame('Live title', $this->liveTitle());
    self::assertSame('Live title', $this->title($this->editor));
  }

  /**
   * The header is activated after authentication, whatever asked before it.
   *
   * Simple OAuth's provider resolves the path while the request is anonymous,
   * and the workspace manager keeps the live answer it gave then.
   */
  public function testTheWorkspaceIsActivatedAfterAnEarlyAnonymousLookup(): void {
    $request = Request::create('/');
    $request->setSession($this->container->get('session'));
    $request->headers->set('X-Druxt-Workspace', 'stage');
    $this->container->get('request_stack')->push($request);
    $manager = $this->container->get('workspaces.manager');

    $this->setCurrentUser(new AnonymousUserSession());
    self::assertNull($manager->getActiveWorkspace());

    $this->setCurrentUser($this->editor);
    $event = new RequestEvent($this->container->get('http_kernel'), $request, HttpKernelInterface::MAIN_REQUEST);
    $this->container->get('druxtjsorg.workspace_header_subscriber')->activate($event);
    self::assertSame('stage', $manager->getActiveWorkspace()?->id());
    self::assertSame('stage', $request->attributes->get(WorkspaceHeaderSubscriber::ATTRIBUTE));
  }

  /**
   * A workspace request whose account the route then drops is refused.
   */
  public function testAWorkspaceRequestThatLosesItsAccountIsRefused(): void {
    $request = Request::create('/');
    $request->attributes->set(WorkspaceHeaderSubscriber::ATTRIBUTE, 'stage');
    $this->setCurrentUser(new AnonymousUserSession());
    $event = new RequestEvent($this->container->get('http_kernel'), $request, HttpKernelInterface::MAIN_REQUEST);

    $this->expectException(AccessDeniedHttpException::class);
    $this->container->get('druxtjsorg.workspace_header_subscriber')->confirm($event);
  }

  /**
   * An entity Workspaces tracks varies its cacheability by workspace.
   */
  public function testATrackedEntityVariesByWorkspace(): void {
    $storage = $this->container->get('entity_type.manager')->getStorage('node');
    $storage->resetCache();
    self::assertContains('workspace', $storage->load($this->page->id())->getCacheContexts());
  }

  /**
   * The title live holds, read from the default revision's table.
   */
  private function liveTitle(): string {
    return (string) $this->container->get('database')
      ->query('SELECT title FROM {node_field_data} WHERE nid = :nid', [':nid' => $this->page->id()])
      ->fetchField();
  }

  /**
   * PATCHes the page's title, optionally naming a workspace.
   */
  private function patch(string $title, ?string $workspace, ?UserInterface $account = NULL): Response {
    $body = Json::encode([
      'data' => [
        'type' => 'node--page',
        'id' => $this->page->uuid(),
        'attributes' => ['title' => $title],
      ],
    ]);
    $request = Request::create('/jsonapi/node/page/' . $this->page->uuid(), 'PATCH', [], [], [], [], $body);
    $request->headers->set('Content-Type', 'application/vnd.api+json');
    return $this->send($request, $account ?? $this->editor, $workspace);
  }

  /**
   * The page's title as an account reads it, optionally in a workspace.
   */
  private function title(?UserInterface $account, ?string $workspace = NULL, ?string $version = NULL): string {
    $query = $version === NULL ? [] : ['resourceVersion' => $version];
    $response = $this->send(Request::create('/jsonapi/node/page/' . $this->page->uuid(), 'GET', $query), $account, $workspace);
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    return Json::decode((string) $response->getContent())['data']['attributes']['title'];
  }

  /**
   * Sends a request through the kernel, as a fresh request would arrive.
   */
  private function send(Request $request, ?UserInterface $account, ?string $workspace): Response {
    $request->headers->set('Accept', 'application/vnd.api+json');
    if ($account !== NULL) {
      // As PHP parses a Basic Authorization header; basic_auth reads these.
      $request->headers->set('PHP_AUTH_USER', $account->getAccountName());
      $request->headers->set('PHP_AUTH_PW', self::PASSWORD);
    }
    if ($workspace !== NULL) {
      $request->headers->set('X-Druxt-Workspace', $workspace);
    }
    // Each request negotiates its own workspace and its own account, as a
    // fresh PHP process would. Services hold the manager, so it is reset, not
    // replaced.
    $manager = $this->container->get('workspaces.manager');
    (new \ReflectionProperty($manager, 'activeWorkspace'))->setValue($manager, NULL);
    $this->setCurrentUser(new AnonymousUserSession());
    $this->container->get('entity.memory_cache')->deleteAll();
    $response = $this->container->get('http_kernel')->handle($request);
    $this->container->get('http_kernel')->terminate($request, $response);
    return $response;
  }

}
