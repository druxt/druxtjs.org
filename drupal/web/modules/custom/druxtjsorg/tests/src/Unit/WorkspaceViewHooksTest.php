<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\Core\Entity\Display\EntityViewDisplayInterface;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\StringTranslation\TranslationInterface;
use Drupal\druxtjsorg\Hook\WorkspaceViewHooks;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * A workspace's overview, by page.
 */
#[CoversClass(WorkspaceViewHooks::class)]
#[Group('druxtjsorg')]
final class WorkspaceViewHooksTest extends UnitTestCase {

  /**
   * An entity whose type names a parent field, or none.
   */
  private function entity(?string $parent_field): EntityInterface {
    $type = $this->createMock(EntityTypeInterface::class);
    $type->method('get')->willReturnMap([['entity_revision_parent_id_field', $parent_field]]);
    $entity = $this->createMock(EntityInterface::class);
    $entity->method('getEntityType')->willReturn($type);
    return $entity;
  }

  /**
   * The build core's view builder makes, reduced to what the hook reads.
   */
  private function build(): array {
    return [
      'changes' => [
        'overview' => ['#type' => 'item', '#markup' => '1 URL alias, 1 content item, 2 Paragraphs'],
        'list' => [
          '#type' => 'table',
          '#header' => [
            'title' => 'Title',
            'type' => 'Type',
            'changed' => 'Last changed',
            'owner' => 'Author',
            'operations' => 'Operations',
          ],
          'node:1' => ['#entity' => $this->entity(NULL)],
          'paragraph:1' => ['#entity' => $this->entity('parent_id')],
          'paragraph:2' => ['#entity' => $this->entity('parent_id')],
          'path_alias:1' => ['#entity' => $this->entity(NULL)],
        ],
      ],
    ];
  }

  /**
   * Runs the hook over a build.
   */
  private function alter(array $build): array {
    $hooks = new WorkspaceViewHooks();
    $hooks->setStringTranslation($this->createMock(TranslationInterface::class));
    $hooks->workspaceViewAlter($build, $this->createMock(EntityInterface::class), $this->createMock(EntityViewDisplayInterface::class));
    return $build;
  }

  /**
   * Paragraphs leave the list, and the page and its alias stay.
   */
  public function testListsWhatStandsOnItsOwn(): void {
    $list = $this->alter($this->build())['changes']['list'];
    self::assertArrayHasKey('node:1', $list);
    self::assertArrayHasKey('path_alias:1', $list);
    self::assertArrayNotHasKey('paragraph:1', $list);
    self::assertArrayNotHasKey('paragraph:2', $list);
  }

  /**
   * The columns a phone can do without are marked for it.
   */
  public function testMarksColumnsForNarrowScreens(): void {
    $header = $this->alter($this->build())['changes']['list']['#header'];
    self::assertSame('Title', $header['title']);
    self::assertSame(['data' => 'Type', 'class' => ['priority-low']], $header['type']);
    self::assertSame(['data' => 'Author', 'class' => ['priority-low']], $header['owner']);
    self::assertSame(['data' => 'Last changed', 'class' => ['priority-medium']], $header['changed']);
  }

  /**
   * The summary says where the paragraphs went, and is printed outside a form.
   */
  public function testExplainsTheMissingParagraphs(): void {
    $overview = $this->alter($this->build())['changes']['overview'];
    self::assertArrayHasKey('#description', $overview);
    self::assertSame('after', $overview['#description_display']);
  }

  /**
   * A build without the changes list is left alone.
   */
  public function testLeavesAnotherBuildAlone(): void {
    $build = ['label' => ['#markup' => 'Stage']];
    self::assertSame($build, $this->alter($build));
  }

}
