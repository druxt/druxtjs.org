<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\druxt_docs\Controller\NodePreviewController;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\node\NodeInterface;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * What the tabbed preview builds around core's node preview.
 */
#[CoversClass(NodePreviewController::class)]
#[Group('druxt_docs')]
#[RunTestsInSeparateProcesses]
final class NodePreviewControllerTest extends KernelTestBase {

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
    'path_alias',
    'serialization',
    'jsonapi',
    'jsonapi_node_preview',
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
    $this->installConfig(['system', 'node']);
    NodeType::create(['type' => 'page', 'name' => 'Page', 'display_submitted' => FALSE])->save();
    $this->container->get('router.builder')->rebuild();
  }

  /**
   * Core's preview bar stays where the page renderer reads it.
   */
  public function testCoresPreviewBarStaysAtTheTopOfThePage(): void {
    self::assertArrayHasKey('node_preview', $this->preview()['#attached']['page_top'] ?? []);
  }

  /**
   * The page has the three tabs.
   */
  public function testThePageHasThreeTabs(): void {
    $html = $this->html();
    self::assertSame(3, substr_count($html, 'role="tab"'));
    foreach (['frontend', 'drupal', 'jsonapi'] as $tab) {
      self::assertStringContainsString('id="druxt-preview-' . $tab . '"', $html);
    }
  }

  /**
   * Without the setting, the frontend tab says so instead of framing nothing.
   */
  public function testTheFrontendTabSaysWhenItIsNotConfigured(): void {
    $html = $this->html();
    self::assertStringContainsString('data-druxt-preview-unconfigured', $html);
    self::assertStringNotContainsString('<iframe', $html);
  }

  /**
   * With the setting, the frontend tab frames the filled-in URL.
   */
  public function testTheFrontendTabFramesTheConfiguredUrl(): void {
    $this->setSetting('druxt_docs_preview_url', '/preview/{uuid}?vm={view_mode}');
    $node = $this->node();
    $html = $this->html($node);
    self::assertStringContainsString('<iframe src="/preview/' . $node->uuid() . '?vm=full"', $html);
    self::assertStringNotContainsString('data-druxt-preview-unconfigured', $html);
  }

  /**
   * The JSON:API tab fetches jsonapi_node_preview's document for the node.
   */
  public function testTheJsonApiTabFetchesThePreviewDocument(): void {
    $node = $this->node();
    self::assertSame('/jsonapi/node/page/' . $node->uuid() . '/preview', $this->preview($node)['#jsonapi_url']);
  }

  /**
   * An unsaved page, flagged as core's Preview button leaves it.
   */
  private function node(): NodeInterface {
    $node = Node::create(['type' => 'page', 'title' => 'Unsaved']);
    $node->in_preview = TRUE;
    return $node;
  }

  /**
   * The controller's build for a node's preview.
   */
  private function preview(?NodeInterface $node = NULL): array {
    return NodePreviewController::create($this->container)->view($node ?? $this->node(), 'full');
  }

  /**
   * The preview rendered to HTML.
   */
  private function html(?NodeInterface $node = NULL): string {
    $build = $this->preview($node);
    return (string) $this->render($build);
  }

}
