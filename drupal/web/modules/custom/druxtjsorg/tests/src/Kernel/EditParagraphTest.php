<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\druxtjsorg\Hook\EditParagraphHooks;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * A page's form, opened at one of its paragraphs.
 */
#[CoversClass(EditParagraphHooks::class)]
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class EditParagraphTest extends KernelTestBase {

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
    $this->installConfig(['system', 'user', 'filter', 'node']);
    NodeType::create(['type' => 'page', 'name' => 'Page'])->save();
    $this->setCurrentUser($this->createUser([], NULL, TRUE));
  }

  /**
   * A paragraph named in the query is handed to the builder to open.
   */
  public function testTheNamedParagraphIsOpened(): void {
    $uuid = 'e6497c75-736f-5da2-9112-56676ba008fe';
    $form = $this->form($uuid);
    self::assertContains('druxtjsorg/edit-paragraph', $form['#attached']['library']);
    self::assertSame($uuid, $form['#attached']['drupalSettings']['druxtjsorg']['editParagraph']);
  }

  /**
   * Anything that is not a uuid opens nothing.
   */
  public function testAnythingElseOpensNothing(): void {
    foreach (['', 'not-a-uuid', '"><script>'] as $value) {
      $form = $this->form($value);
      self::assertNotContains('druxtjsorg/edit-paragraph', $form['#attached']['library'] ?? [], $value);
    }
  }

  /**
   * The page's edit form, for a request naming a paragraph.
   */
  private function form(string $paragraph): array {
    \Drupal::request()->query->set(EditParagraphHooks::QUERY, $paragraph);
    $node = Node::create(['type' => 'page', 'title' => 'Page']);
    $node->save();
    return $this->container->get('entity.form_builder')->getForm($node, 'default');
  }

}
