<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\druxt_docs\Config\RedirectInWorkspaceOverride;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\Tests\workspaces\Kernel\WorkspaceTestTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Renaming a page in a workspace, with the redirect module making redirects.
 *
 * A redirect can only be saved in Live, so the redirect module's redirect
 * from an alias changed in a workspace would refuse the whole save. The
 * redirect is made when the workspace is published instead, which is when
 * the old alias stops working.
 */
#[CoversClass(RedirectInWorkspaceOverride::class)]
#[Group('druxt_docs')]
final class RedirectInWorkspaceTest extends KernelTestBase {

  use IssuePatternTrait;
  use UserCreationTrait;
  use WorkspaceTestTrait;

  /**
   * The entity type manager, which WorkspaceTestTrait sets.
   */
  protected EntityTypeManagerInterface $entityTypeManager;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'filter',
    'text',
    'link',
    'views',
    'node',
    'path',
    'path_alias',
    'redirect',
    'token',
    'pathauto',
    'druxt_docs',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('node');
    $this->installEntitySchema('path_alias');
    $this->installEntitySchema('redirect');
    $this->installSchema('node', ['node_access']);
    $this->installConfig(['filter', 'node', 'redirect']);
    $this->installIssuePattern();
    NodeType::create(['type' => 'docs_issue', 'name' => 'Troubleshooting issue'])->save();
    $this->initializeWorkspacesModule();
  }

  /**
   * An issue renamed in a workspace saves, and redirects once published.
   */
  public function testARenameInAWorkspaceRedirectsWhenPublished(): void {
    $issue = $this->createEntity('node', ['type' => 'docs_issue', 'title' => 'Old title']);
    $this->switchToWorkspace('stage');
    $issue->setTitle('New title')->save();
    self::assertSame([], $this->redirects(), 'No redirect is made in the workspace.');

    $this->switchToLive();
    $this->container->get('workspaces.operation_factory')->getPublisher($this->workspaces['stage'])->publish();
    self::assertSame(['how-to/troubleshooting/old-title' => 'internal:/node/' . $issue->id()], $this->redirects());
  }

  /**
   * In Live, a rename redirects at once, as the redirect module's setting says.
   */
  public function testARenameInLiveRedirectsAtOnce(): void {
    $issue = $this->createEntity('node', ['type' => 'docs_issue', 'title' => 'Old title']);
    $issue->setTitle('New title')->save();
    self::assertSame(['how-to/troubleshooting/old-title' => 'internal:/node/' . $issue->id()], $this->redirects());
  }

  /**
   * Every redirect, as its source path and its target.
   *
   * @return array<string, string>
   *   Targets keyed by source path.
   */
  private function redirects(): array {
    $redirects = [];
    foreach ($this->container->get('entity_type.manager')->getStorage('redirect')->loadMultiple() as $redirect) {
      $redirects[$redirect->getSourcePathWithQuery()] = $redirect->get('redirect_redirect')->uri;
    }
    // Source paths are stored without their leading slash.
    return array_combine(array_map(fn (string $path): string => ltrim($path, '/'), array_keys($redirects)), $redirects);
  }

}
