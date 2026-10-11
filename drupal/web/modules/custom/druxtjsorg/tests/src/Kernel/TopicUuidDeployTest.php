<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\druxtjsorg\TopicUuid;
use Drupal\KernelTests\KernelTestBase;
use Drupal\taxonomy\Entity\Term;
use Drupal\taxonomy\Entity\Vocabulary;
use PHPUnit\Framework\Attributes\Group;

/**
 * The deploy hook gives the topics the UUID every site derives from the name.
 */
#[Group('druxtjsorg')]
final class TopicUuidDeployTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'text',
    'filter',
    'taxonomy',
    'druxtjsorg',
  ];

  /**
   * A topic minted at random is re-keyed, and the result is stable.
   */
  public function testTopicsTakeTheDerivedUuid(): void {
    $this->installEntitySchema('user');
    $this->installEntitySchema('taxonomy_term');
    Vocabulary::create(['vid' => 'documentation_topic', 'name' => 'Topic'])->save();
    Vocabulary::create(['vid' => 'documentation_section', 'name' => 'Section'])->save();
    $this->container->get('module_handler')->loadInclude('druxtjsorg', 'php', 'druxtjsorg.deploy');

    $topic = Term::create(['vid' => 'documentation_topic', 'name' => 'Set up']);
    $topic->save();
    $section = Term::create(['vid' => 'documentation_section', 'name' => 'Tutorials']);
    $section->save();
    $random = $topic->uuid();
    self::assertNotSame(TopicUuid::for('Set up'), $random);

    self::assertSame('Re-keyed 1 topics.', druxtjsorg_deploy_topic_uuids());
    $storage = $this->container->get('entity_type.manager')->getStorage('taxonomy_term');
    $reloaded = $storage->load($topic->id());
    self::assertSame(TopicUuid::for('Set up'), $reloaded->uuid());
    self::assertSame($topic->id(), $this->container->get('entity.repository')->loadEntityByUuid('taxonomy_term', TopicUuid::for('Set up'))->id());
    self::assertSame($section->uuid(), $storage->load($section->id())->uuid(), 'other vocabularies are left alone');

    self::assertSame('Re-keyed 0 topics.', druxtjsorg_deploy_topic_uuids());
    self::assertMatchesRegularExpression('/^[0-9a-f-]{36}$/', TopicUuid::for('Build'));
    self::assertNotSame(TopicUuid::for('Build'), TopicUuid::for('Set up'));
  }

}
