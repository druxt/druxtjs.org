<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\druxt_docs\Plugin\Field\TableOfContentsItemList;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\filter\Entity\FilterFormat;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\NodeType;
use Drupal\node\NodeInterface;
use Drupal\paragraphs\Entity\Paragraph;
use Drupal\paragraphs\Entity\ParagraphsType;
use Drupal\paragraphs\ParagraphInterface;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * The computed field_toc on a page built from real paragraphs.
 */
#[CoversClass(TableOfContentsItemList::class)]
#[Group('druxt_docs')]
final class TableOfContentsFieldTest extends KernelTestBase {

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
    'layout_discovery',
    'layout_paragraphs',
    'path_alias',
    'druxt_docs',
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
    $this->installConfig(['filter']);

    // Headings as the site's basic_html allows them: h2 to h6, no h1.
    FilterFormat::create([
      'format' => 'basic_html',
      'name' => 'Basic HTML',
      'filters' => [
        'filter_html' => [
          'status' => TRUE,
          'settings' => ['allowed_html' => '<p> <h2> <h3> <h4> <h5> <h6> <strong> <em> <code>'],
        ],
      ],
    ])->save();

    NodeType::create(['type' => 'doc_page', 'name' => 'Documentation page'])->save();
    foreach (['docs_layout_section' => NULL, 'docs_text' => 'field_text', 'docs_rich_text' => 'field_rich_text'] as $bundle => $field) {
      ParagraphsType::create(['id' => $bundle, 'label' => $bundle])->save();
      if ($field !== NULL) {
        FieldStorageConfig::create(['field_name' => $field, 'entity_type' => 'paragraph', 'type' => 'text_long'])->save();
        FieldConfig::create(['field_name' => $field, 'entity_type' => 'paragraph', 'bundle' => $bundle, 'label' => 'Text'])->save();
      }
    }
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
      'label' => 'Content',
      'settings' => ['handler' => 'default:paragraph'],
    ])->save();
  }

  /**
   * Rich text gives the headings its format renders, not the ones it stores.
   *
   * basic_html has no h1, so a stored h1 is not a heading on the page, and
   * ids go on being numbered across the page's blocks.
   */
  public function testRichTextGivesTheHeadingsItsFormatRenders(): void {
    $page = $this->page([
      $this->richText('<h1>Stripped</h1><h2>Setup</h2><h3>Shown <code>druxt</code></h3>'),
      Paragraph::create(['type' => 'docs_text', 'field_text' => ['value' => "## Setup\n\nProse.", 'format' => 'plain_text']]),
    ]);
    self::assertSame([
      ['id' => 'setup', 'depth' => 2, 'text' => 'Setup'],
      ['id' => 'shown-druxt', 'depth' => 3, 'text' => 'Shown druxt'],
      ['id' => 'setup-1', 'depth' => 2, 'text' => 'Setup'],
    ], $page->get('field_toc')->getValue());
  }

  /**
   * The value depends on the text format as well as the paragraph.
   */
  public function testTheTextFormatIsACacheDependency(): void {
    $rich_text = $this->richText('<h2>Setup</h2>');
    $tags = $this->page([$rich_text])->get('field_toc')->getCacheTags();
    self::assertContains('paragraph:' . $rich_text->id(), $tags);
    self::assertContains('config:filter.format.basic_html', $tags);
  }

  /**
   * A rich text block in basic_html.
   */
  private function richText(string $html): ParagraphInterface {
    return Paragraph::create(['type' => 'docs_rich_text', 'field_rich_text' => ['value' => $html, 'format' => 'basic_html']]);
  }

  /**
   * A saved page holding blocks in one single-column section, read back.
   *
   * @param \Drupal\paragraphs\ParagraphInterface[] $blocks
   *   The blocks, in order.
   */
  private function page(array $blocks): NodeInterface {
    $section = Paragraph::create(['type' => 'docs_layout_section']);
    $section->setBehaviorSettings('layout_paragraphs', ['layout' => 'layout_onecol', 'config' => [], 'parent_uuid' => '', 'region' => '']);
    foreach ($blocks as $block) {
      $block->setBehaviorSettings('layout_paragraphs', ['parent_uuid' => $section->uuid(), 'region' => 'content']);
    }
    $storage = $this->container->get('entity_type.manager')->getStorage('node');
    $page = $storage->create(['type' => 'doc_page', 'title' => 'Page', 'field_content' => [$section, ...$blocks]]);
    $page->save();
    return $storage->loadUnchanged($page->id());
  }

}
