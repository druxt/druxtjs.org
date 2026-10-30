<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\Core\Form\FormState;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\node\NodeInterface;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * An editor's unsaved preview, compared with the live page.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class PreviewDiffResourceTest extends KernelTestBase {

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
    'node',
    'serialization',
    'image',
    'file',
    'consumers',
    'path_alias',
    'decoupled_router',
    'jsonapi',
    'jsonapi_hypermedia',
    'jsonapi_resources',
    'diff',
    'jsonapi_diff',
    'druxt',
    'druxtjsorg',
  ];

  /**
   * The live page.
   */
  private NodeInterface $node;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('node');
    $this->installEntitySchema('consumer');
    $this->installEntitySchema('path_alias');
    $this->installSchema('node', ['node_access']);
    $this->installConfig(['system', 'user', 'node', 'filter', 'diff', 'druxt', 'druxtjsorg']);
    NodeType::create(['type' => 'page', 'name' => 'Page', 'new_revision' => TRUE])->save();
    // Uid 1 bypasses every access check, so it is spent here.
    $this->createUser();
    $this->node = Node::create(['type' => 'page', 'title' => 'The live title', 'status' => 1]);
    $this->node->save();
    $this->container->get('router.builder')->rebuild();
  }

  /**
   * Holds an unsaved edit of the page as the current user's preview.
   */
  private function preview(string $title): void {
    $edited = Node::load($this->node->id());
    $edited->setTitle($title);
    $form = $this->container->get('entity_type.manager')->getFormObject('node', 'default')->setEntity($edited);
    $form_state = (new FormState())->setFormObject($form);
    $this->container->get('tempstore.private')->get('node_preview')->set($edited->uuid(), $form_state);
    // The edit was made on the storage's cached copy. A request loads the
    // live page afresh, as it does outside a test.
    $this->container->get('entity_type.manager')->getStorage('node')->resetCache();
  }

  /**
   * Requests the preview diff as the current user.
   */
  private function request(string $type = 'node/page'): Response {
    $request = Request::create("/jsonapi/diff-preview/$type/" . $this->node->uuid());
    $request->headers->set('Accept', 'application/vnd.api+json');
    return $this->container->get('http_kernel')->handle($request);
  }

  /**
   * An editor sees their unsaved title against the live one, never cached.
   */
  public function testTheEditorsPreviewAgainstLive(): void {
    $this->setCurrentUser($this->createUser(['access content', 'view all revisions']));
    $this->preview('The unsaved title');
    $response = $this->request();
    self::assertSame(200, $response->getStatusCode(), (string) $response->getContent());
    self::assertStringContainsString('private', (string) $response->headers->get('Cache-Control'));
    self::assertStringContainsString('no-cache', (string) $response->headers->get('Cache-Control'));
    $content = (string) $response->getContent();
    self::assertStringContainsString('The live title', $content);
    self::assertStringContainsString('The unsaved title', $content);
    $document = json_decode($content, TRUE);
    self::assertSame(1, $document['data']['attributes']['summary']['changed']);
    // Nothing was saved: the live page is as it was.
    self::assertSame('The live title', Node::load($this->node->id())->getTitle());
  }

  /**
   * Without a preview of their own, the answer is the not found one.
   */
  public function testNoPreviewIsNotFound(): void {
    $this->setCurrentUser($this->createUser(['access content', 'view all revisions']));
    self::assertSame(404, $this->request()->getStatusCode());
  }

  /**
   * A type the site does not have is the same not found answer, not an error.
   */
  public function testUnknownTypeIsNotFound(): void {
    $this->setCurrentUser($this->createUser(['access content', 'view all revisions']));
    $this->preview('The unsaved title');
    self::assertSame(404, $this->request('no_such_type/page')->getStatusCode());
  }

  /**
   * One editor's preview is never another's to read.
   */
  public function testAnotherEditorsPreviewIsNotFound(): void {
    $this->setCurrentUser($this->createUser(['access content', 'view all revisions']));
    $this->preview('Someone else\'s title');
    $this->setCurrentUser($this->createUser(['access content', 'view all revisions']));
    $response = $this->request();
    self::assertSame(404, $response->getStatusCode());
    self::assertStringNotContainsString('Someone else', (string) $response->getContent());
  }

}
