<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\field\Entity\FieldConfig;
use Drupal\language\Entity\ConfigurableLanguage;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\Node;
use Drupal\node\Entity\NodeType;
use Drupal\paragraphs\Entity\Paragraph;
use Drupal\paragraphs\Entity\ParagraphsType;
use PHPUnit\Framework\Attributes\Group;

/**
 * A reference to another site's revision id lands on the target's own.
 */
#[Group('druxtjsorg')]
final class ReferenceRevisionHooksTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'file',
    'node',
    'entity_reference_revisions',
    'paragraphs',
    'language',
    'content_translation',
    'druxtjsorg',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('node');
    $this->installEntitySchema('paragraph');
    $this->installSchema('node', ['node_access']);
    NodeType::create(['type' => 'page', 'name' => 'Page'])->save();
    ParagraphsType::create(['id' => 'text', 'label' => 'Text'])->save();
    FieldStorageConfig::create([
      'field_name' => 'field_content',
      'entity_type' => 'node',
      'type' => 'entity_reference_revisions',
      'settings' => ['target_type' => 'paragraph'],
      'cardinality' => -1,
    ])->save();
    FieldConfig::create(['field_name' => 'field_content', 'entity_type' => 'node', 'bundle' => 'page'])->save();
  }

  /**
   * A stray or missing revision id takes the target's current revision.
   */
  public function testStrayRevisionsArePointedAtTheTarget(): void {
    $other = Paragraph::create(['type' => 'text']);
    $other->save();
    $first = Paragraph::create(['type' => 'text']);
    $first->save();
    $first->setNewRevision(TRUE);
    $first->save();
    $current = $first->getRevisionId();
    self::assertNotSame($other->getRevisionId(), $current);

    $node = Node::create([
      'type' => 'page',
      'title' => 'Deployed',
      'field_content' => [
        ['target_id' => $first->id(), 'target_revision_id' => $other->getRevisionId()],
        ['target_id' => $other->id(), 'target_revision_id' => 999999],
        ['target_id' => $other->id(), 'target_revision_id' => $other->getRevisionId()],
      ],
    ]);
    $node->save();

    $items = Node::load($node->id())->get('field_content')->getValue();
    self::assertSame((int) $current, (int) $items[0]['target_revision_id'], 'another paragraph\'s revision is replaced');
    self::assertSame((int) $other->getRevisionId(), (int) $items[1]['target_revision_id'], 'a revision that does not exist is replaced');
    self::assertSame((int) $other->getRevisionId(), (int) $items[2]['target_revision_id'], 'a right reference is kept');
  }

  /**
   * A translation's own reference is re-pointed too.
   */
  public function testTranslationsAreRepointed(): void {
    ConfigurableLanguage::createFromLangcode('fr')->save();
    $field = FieldConfig::loadByName('node', 'page', 'field_content');
    $field->setTranslatable(TRUE)->save();
    $this->container->get('content_translation.manager')->setEnabled('node', 'page', TRUE);

    $en = Paragraph::create(['type' => 'text']);
    $en->save();
    $fr = Paragraph::create(['type' => 'text']);
    $fr->save();
    $fr->setNewRevision(TRUE);
    $fr->save();

    $node = Node::create([
      'type' => 'page',
      'title' => 'Deployed',
      'field_content' => [['target_id' => $en->id(), 'target_revision_id' => $en->getRevisionId()]],
    ]);
    $node->addTranslation('fr', [
      'title' => 'Déployé',
      'field_content' => [['target_id' => $fr->id(), 'target_revision_id' => $en->getRevisionId()]],
    ]);
    $node->save();

    $items = Node::load($node->id())->getTranslation('fr')->get('field_content')->getValue();
    self::assertSame((int) $fr->getRevisionId(), (int) $items[0]['target_revision_id'], 'the French reference lands on its own paragraph');
  }

}
