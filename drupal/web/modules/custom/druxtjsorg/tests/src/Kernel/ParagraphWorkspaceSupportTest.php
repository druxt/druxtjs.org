<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\druxtjsorg\Hook\WorkspaceEntityTypeHooks;
use Drupal\KernelTests\KernelTestBase;
use Drupal\workspaces\Entity\Handler\DefaultWorkspaceHandler;
use Drupal\workspaces\WorkspaceInformation;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * Paragraphs stay tracked by Workspaces beside Workspaces Extra.
 */
#[CoversClass(WorkspaceEntityTypeHooks::class)]
#[Group('druxtjsorg')]
final class ParagraphWorkspaceSupportTest extends KernelTestBase {

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
   * Workspaces Extra marks paragraphs ignored; this site tracks them.
   *
   * The container's information service remembers each type's answer from
   * install time, so a fresh one is asked, as the site's cache rebuild after
   * a deploy does.
   */
  public function testParagraphsAreSupportedBesideWorkspacesExtra(): void {
    $type = $this->container->get('entity_type.manager')->getDefinition('paragraph');
    self::assertSame(DefaultWorkspaceHandler::class, $type->getHandlerClass('workspace'));
    // A fresh information service, which remembers nothing from install time.
    $information = new WorkspaceInformation($this->container->get('entity_type.manager'), $this->container->get('workspaces.tracker'));
    self::assertTrue($information->isEntityTypeSupported($type));
    // Extra's own protection still applies to them.
    self::assertArrayHasKey('WseClosedWorkspace', $type->getConstraints());
  }

}
