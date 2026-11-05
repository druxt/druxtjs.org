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
    'options',
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
    ParagraphsType::create(['id' => 'docs_issue', 'label' => 'Issue'])->save();
    FieldStorageConfig::create([
      'field_name' => 'field_issue_area',
      'entity_type' => 'paragraph',
      'type' => 'list_string',
      'settings' => ['allowed_values' => ['install' => 'Install and build', 'backend' => 'Drupal backend', 'stale' => 'Stale or changed content']],
    ])->save();
    FieldConfig::create(['field_name' => 'field_issue_area', 'entity_type' => 'paragraph', 'bundle' => 'docs_issue', 'label' => 'Area'])->save();
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
   * A run of issues gives its areas once each, in the field's order.
   *
   * Their fixes are closed, so a heading inside one is not listed, and the
   * page's headings after the run are numbered as before.
   */
  public function testIssuesAreListedByTheirAreas(): void {
    $intro = $this->section([$this->text("## Before you start\n\nProse.")]);
    $issues = [
      ...$this->issue('stale', "## Inside a fix\n\nProse."),
      ...$this->issue('install', 'Prose.'),
      ...$this->issue('install', 'Prose.'),
    ];
    $unpublished = $this->issue('backend', 'Prose.');
    $unpublished[0]->setUnpublished();
    $after = $this->section([$this->text("## Still stuck?\n\nProse.")]);
    $page = $this->save([...$intro, ...$issues, ...$unpublished, ...$after]);
    self::assertSame([
      ['id' => 'before-you-start', 'depth' => 2, 'text' => 'Before you start'],
      ['id' => 'install-and-build', 'depth' => 2, 'text' => 'Install and build'],
      ['id' => 'stale-or-changed-content', 'depth' => 2, 'text' => 'Stale or changed content'],
      ['id' => 'still-stuck', 'depth' => 2, 'text' => 'Still stuck?'],
    ], $page->get('field_toc')->getValue());
    // The area headings are the field storage's labels, so editing them
    // has to clear the computed value.
    self::assertContains('config:field.storage.paragraph.field_issue_area', $page->get('field_toc')->getCacheTags());
  }

  /**
   * A markdown text block.
   */
  private function text(string $markdown): ParagraphInterface {
    return Paragraph::create(['type' => 'docs_text', 'field_text' => ['value' => $markdown, 'format' => 'plain_text']]);
  }

  /**
   * An Issue block in an area, with one text block as its fix.
   *
   * @return \Drupal\paragraphs\ParagraphInterface[]
   *   The issue, then its fix.
   */
  private function issue(string $area, string $markdown): array {
    $issue = Paragraph::create(['type' => 'docs_issue', 'field_issue_area' => $area]);
    $issue->setBehaviorSettings('layout_paragraphs', ['layout' => 'layout_onecol', 'config' => [], 'parent_uuid' => '', 'region' => '']);
    $fix = $this->text($markdown);
    $fix->setBehaviorSettings('layout_paragraphs', ['parent_uuid' => $issue->uuid(), 'region' => 'content']);
    return [$issue, $fix];
  }

  /**
   * A single-column section holding blocks.
   *
   * @param \Drupal\paragraphs\ParagraphInterface[] $blocks
   *   The blocks, in order.
   *
   * @return \Drupal\paragraphs\ParagraphInterface[]
   *   The section, then its blocks.
   */
  private function section(array $blocks): array {
    $section = Paragraph::create(['type' => 'docs_layout_section']);
    $section->setBehaviorSettings('layout_paragraphs', ['layout' => 'layout_onecol', 'config' => [], 'parent_uuid' => '', 'region' => '']);
    foreach ($blocks as $block) {
      $block->setBehaviorSettings('layout_paragraphs', ['parent_uuid' => $section->uuid(), 'region' => 'content']);
    }
    return [$section, ...$blocks];
  }

  /**
   * A saved page holding these paragraphs, read back.
   *
   * @param \Drupal\paragraphs\ParagraphInterface[] $paragraphs
   *   The page's paragraphs, in order.
   */
  private function save(array $paragraphs): NodeInterface {
    $storage = $this->container->get('entity_type.manager')->getStorage('node');
    $page = $storage->create(['type' => 'doc_page', 'title' => 'Page', 'field_content' => $paragraphs]);
    $page->save();
    return $storage->loadUnchanged($page->id());
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
