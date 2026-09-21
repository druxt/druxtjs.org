<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\Hook\DruxtResourcesHooks;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\TestCase;

/**
 * Tests the resources the documentation frontend needs Druxt to expose.
 */
#[CoversClass(DruxtResourcesHooks::class)]
#[Group('druxt_docs')]
final class DruxtResourcesHooksTest extends TestCase {

  /**
   * The editing widgets' text formats and editors join Druxt's list.
   */
  public function testAddsTheEditorResources(): void {
    $resources = ['block--block', 'menu--menu'];
    (new DruxtResourcesHooks())->druxtResourcesAlter($resources);
    $this->assertSame(
      ['block--block', 'menu--menu', 'editor--editor', 'filter_format--filter_format'],
      $resources,
    );
  }

  /**
   * A resource the configuration already lists is not listed twice.
   */
  public function testDoesNotRepeatAResource(): void {
    $resources = ['editor--editor', 'block--block'];
    (new DruxtResourcesHooks())->druxtResourcesAlter($resources);
    $this->assertSame(['editor--editor', 'block--block', 'filter_format--filter_format'], $resources);
  }

}
