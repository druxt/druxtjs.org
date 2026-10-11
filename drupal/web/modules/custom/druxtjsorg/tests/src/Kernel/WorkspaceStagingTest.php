<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\node\NodeInterface;
use Drupal\paragraphs\Entity\Paragraph;
use Drupal\paragraphs\Entity\ParagraphsType;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\workflows\Entity\Workflow;
use Drupal\workspaces\Entity\Workspace;
use Drupal\workspaces\WorkspaceInterface;
use Drupal\workspaces\WorkspacePublishException;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * A doc page and its paragraphs staged in a workspace, under moderation.
 *
 * The site moderates doc pages and keeps their content in paragraphs, so a
 * workspace has to hold both off live, and publishing it has to move both.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class WorkspaceStagingTest extends KernelTestBase {

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
    'entity_reference_revisions',
    'paragraphs',
    'workflows',
    'content_moderation',
    'workspaces',
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
    $this->installEntitySchema('paragraph');
    $this->installEntitySchema('content_moderation_state');
    $this->installSchema('node', ['node_access']);
    $this->installConfig(['filter', 'user', 'content_moderation']);
    // As on the site; without it every refusal below would pass for nothing.
    user_role_grant_permissions('anonymous', ['access content']);
    $this->setCurrentUser($this->createUser([], NULL, TRUE));

    NodeType::create(['type' => 'doc_page', 'name' => 'Documentation page'])->save();
    ParagraphsType::create(['id' => 'docs_text', 'label' => 'Text'])->save();
    FieldStorageConfig::create(['field_name' => 'field_text', 'entity_type' => 'paragraph', 'type' => 'text_long'])->save();
    FieldConfig::create(['field_name' => 'field_text', 'entity_type' => 'paragraph', 'bundle' => 'docs_text'])->save();
    FieldStorageConfig::create([
      'field_name' => 'field_content',
      'entity_type' => 'node',
      'type' => 'entity_reference_revisions',
      'cardinality' => FieldStorageConfig::CARDINALITY_UNLIMITED,
      'settings' => ['target_type' => 'paragraph'],
    ])->save();
    FieldConfig::create([
      'field_name' => 'field_content',
      'entity_type' => 'node',
      'bundle' => 'doc_page',
      'settings' => ['handler' => 'default:paragraph'],
    ])->save();

    $workflow = Workflow::create(['id' => 'editorial', 'label' => 'Editorial', 'type' => 'content_moderation']);
    $configuration = $workflow->getTypePlugin()->getConfiguration();
    $configuration['default_moderation_state'] = 'draft';
    $configuration['entity_types'] = ['node' => ['doc_page']];
    $workflow->getTypePlugin()->setConfiguration($configuration);
    $workflow->save();

    $this->stage = Workspace::create(['id' => 'stage', 'label' => 'Stage']);
    $this->stage->save();
  }

  /**
   * A published edit in a workspace stays off live until it is published.
   */
  public function testAWorkspaceHoldsAPageAndItsParagraphsOffLive(): void {
    $page = $this->livePage('Live words');

    $this->inStage(function () use ($page): void {
      $this->edit($page, 'Staged words', 'published');
    });

    self::assertSame('Live words', $this->text($page));
    self::assertSame('Staged words', $this->inStage(fn () => $this->text($page)));

    $this->stage->publish();

    self::assertSame('Staged words', $this->text($page));
    self::assertTrue($this->load($page)->isPublished());
    self::assertSame([], $this->container->get('workspaces.tracker')->getTrackedEntities('stage'));
  }

  /**
   * A new page created in a workspace is not readable on live.
   */
  public function testAPageCreatedInAWorkspaceIsNotReadableOnLive(): void {
    $id = $this->inStage(function (): int {
      $page = Node::create([
        'type' => 'doc_page',
        'title' => 'New page',
        'moderation_state' => 'published',
        'field_content' => [Paragraph::create(['type' => 'docs_text', 'field_text' => 'New words'])],
      ]);
      $page->save();
      return (int) $page->id();
    });

    // Live holds an unpublished placeholder whose field already names the
    // staged paragraph revision. A reader is refused the page, and a paragraph
    // read on its own loads its unpublished default revision.
    $live = $this->load(Node::load($id));
    self::assertFalse($live->isPublished());
    $anonymous = new AnonymousUserSession();
    self::assertFalse($live->access('view', $anonymous));
    $paragraph = $live->get('field_content')->entity;
    self::assertFalse(Paragraph::load($paragraph->id())->access('view', $anonymous));

    $this->stage->publish();

    $page = $this->load($live);
    self::assertTrue($page->isPublished());
    self::assertTrue($page->access('view', $anonymous));
    self::assertSame('New words', $this->text($page));
  }

  /**
   * A draft left in a workspace stops the whole set from going live.
   *
   * Inside a workspace a page is saved published, meaning it goes live with
   * the workspace; core refuses to publish one still holding a draft.
   */
  public function testADraftInAWorkspaceBlocksItsRelease(): void {
    $page = $this->livePage('Live words');
    $this->inStage(function () use ($page): void {
      $this->edit($page, 'Draft words', 'draft');
    });

    try {
      $this->stage->publish();
      self::fail('The workspace was published with a draft in it.');
    }
    catch (WorkspacePublishException $e) {
      self::assertStringContainsString('unpublished moderation state', $e->getMessage());
    }
    self::assertSame('Live words', $this->text($page));
  }

  /**
   * A page published on live with one paragraph.
   */
  private function livePage(string $text): NodeInterface {
    $page = Node::create([
      'type' => 'doc_page',
      'title' => 'Page',
      'moderation_state' => 'published',
      'field_content' => [Paragraph::create(['type' => 'docs_text', 'field_text' => $text])],
    ]);
    $page->save();
    return $page;
  }

  /**
   * Changes the page's paragraph and saves it in the given state.
   */
  private function edit(NodeInterface $page, string $text, string $state): void {
    $page = $this->load($page);
    // A form widget or a JSON:API write saves the paragraph; this flags it.
    $page->get('field_content')->entity->set('field_text', $text)->setNeedsSave(TRUE);
    $page->set('moderation_state', $state);
    $page->save();
  }

  /**
   * The page's paragraph text, as the active workspace sees it.
   */
  private function text(NodeInterface $page): string {
    return (string) $this->load($page)->get('field_content')->entity->get('field_text')->value;
  }

  /**
   * The page, freshly loaded in the active workspace.
   */
  private function load(NodeInterface $page): NodeInterface {
    $storage = $this->container->get('entity_type.manager')->getStorage('node');
    $storage->resetCache();
    $this->container->get('entity_type.manager')->getStorage('paragraph')->resetCache();
    return $storage->load($page->id());
  }

  /**
   * Runs a function in the stage workspace.
   */
  private function inStage(callable $function): mixed {
    return $this->container->get('workspaces.manager')->executeInWorkspace('stage', $function);
  }

}
