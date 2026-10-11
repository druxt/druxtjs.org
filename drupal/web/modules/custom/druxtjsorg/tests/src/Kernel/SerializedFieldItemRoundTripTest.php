<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\jsonapi\JsonApiResource\JsonApiDocumentTopLevel;
use Drupal\jsonapi\JsonApiResource\LinkCollection;
use Drupal\jsonapi\JsonApiResource\NullIncludedData;
use Drupal\jsonapi\JsonApiResource\ResourceObject;
use Drupal\jsonapi\JsonApiResource\ResourceObjectData;
use Drupal\KernelTests\KernelTestBase;
use Drupal\paragraphs\Entity\Paragraph;
use Drupal\paragraphs\Entity\ParagraphsType;
use PHPUnit\Framework\Attributes\Group;

/**
 * A paragraph's behavior settings survive a JSON:API export and import.
 *
 * Workspaces Deploy moves entities between sites through the JSON:API
 * serializer, and the site stores Layout Paragraphs' placement there.
 */
#[Group('druxtjsorg')]
final class SerializedFieldItemRoundTripTest extends KernelTestBase {

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
    'entity_reference_revisions',
    'paragraphs',
    'options',
    'workspaces',
    'druxtjsorg',
  ];

  /**
   * The flattened, unserialized export denormalizes back to the stored value.
   */
  public function testBehaviorSettingsRoundTrip(): void {
    $this->installEntitySchema('user');
    $this->installEntitySchema('paragraph');
    ParagraphsType::create(['id' => 'text', 'label' => 'Text'])->save();

    $settings = [
      'layout_paragraphs' => [
        'layout' => '',
        'config' => [],
        'parent_uuid' => 'd9884f60-2ac1-5a5e-885e-6eb98866348b',
        'region' => 'content',
      ],
    ];
    $paragraph = Paragraph::create(['type' => 'text', 'behavior_settings' => serialize($settings)]);
    $paragraph->save();

    $serializer = $this->container->get('jsonapi.serializer');
    $resource_type = $this->container->get('jsonapi.resource_type.repository')->get('paragraph', 'text');
    $document = new JsonApiDocumentTopLevel(new ResourceObjectData([ResourceObject::createFromEntity($resource_type, $paragraph)], 1), new NullIncludedData(), new LinkCollection([]));
    $export = $serializer->normalize($document, 'api_json', ['resource_type' => $resource_type])->getNormalization();
    self::assertSame($settings, $export['data']['attributes']['behavior_settings'], 'core exports the settings unserialized and flattened');

    $imported = $serializer->denormalize(['data' => $export['data']], JsonApiDocumentTopLevel::class, 'api_json', ['resource_type' => $resource_type]);
    self::assertInstanceOf(Paragraph::class, $imported);
    self::assertSame($paragraph->get('behavior_settings')->value, $imported->get('behavior_settings')->value);
    self::assertSame($settings, $imported->getAllBehaviorSettings());
  }

}
