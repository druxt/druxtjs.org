<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\druxt_docs\Hook\IssueHooks;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\NodeType;
use Drupal\node\NodeInterface;
use Drupal\paragraphs\Entity\Paragraph;
use Drupal\paragraphs\Entity\ParagraphsType;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * A troubleshooting issue's alias and search text, set as it is saved.
 *
 * The alias comes from the site's pathauto settings and docs_issue pattern.
 */
#[CoversClass(IssueHooks::class)]
#[Group('druxt_docs')]
final class IssueHooksTest extends KernelTestBase {

  use IssuePatternTrait;

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
    'link',
    'views',
    'node',
    'entity_reference_revisions',
    'paragraphs',
    'options',
    'layout_discovery',
    'layout_paragraphs',
    'path',
    'path_alias',
    'redirect',
    'token',
    'pathauto',
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
    $this->installEntitySchema('path_alias');
    $this->installEntitySchema('redirect');
    $this->installSchema('node', ['node_access']);
    $this->installConfig(['filter', 'redirect']);

    NodeType::create(['type' => 'docs_issue', 'name' => 'Troubleshooting issue'])->save();
    NodeType::create(['type' => 'doc_page', 'name' => 'Documentation page'])->save();
    $fields = [
      'docs_text' => ['field_text', 'text_long'],
      'docs_code' => ['field_code', 'string_long'],
      'docs_rich_text' => ['field_rich_text', 'text_long'],
    ];
    foreach ($fields as $bundle => [$field, $type]) {
      ParagraphsType::create(['id' => $bundle, 'label' => $bundle])->save();
      FieldStorageConfig::create(['field_name' => $field, 'entity_type' => 'paragraph', 'type' => $type])->save();
      FieldConfig::create(['field_name' => $field, 'entity_type' => 'paragraph', 'bundle' => $bundle, 'label' => 'Text'])->save();
    }
    $node_fields = [
      'field_description' => ['type' => 'string_long'],
      'field_issue_search_text' => ['type' => 'string_long'],
      'field_content' => [
        'type' => 'entity_reference_revisions',
        'cardinality' => FieldStorageConfig::CARDINALITY_UNLIMITED,
        'settings' => ['target_type' => 'paragraph'],
      ],
    ];
    foreach ($node_fields as $field => $storage) {
      FieldStorageConfig::create(['field_name' => $field, 'entity_type' => 'node'] + $storage)->save();
      foreach (['docs_issue', 'doc_page'] as $bundle) {
        FieldConfig::create([
          'field_name' => $field,
          'entity_type' => 'node',
          'bundle' => $bundle,
          'label' => $field,
          'settings' => $field === 'field_content' ? ['handler' => 'default:paragraph'] : [],
        ])->save();
      }
    }

    $this->installIssuePattern();
  }

  /**
   * An issue's alias is its title, cleaned by pathauto's rules, under the
   * troubleshooting page's path.
   */
  public function testTheAliasIsTheTitleByPathautosRules(): void {
    $issue = $this->issue('CORS errors in `nuxt dev`');
    self::assertSame('/how-to/troubleshooting/cors-errors-nuxt-dev', $this->alias($issue));
  }

  /**
   * A second issue with the same title is numbered by pathauto.
   */
  public function testARepeatedTitleIsNumbered(): void {
    $first = $this->issue('Stale content');
    $second = $this->issue('Stale content');
    $third = $this->issue('Stale content');
    self::assertSame('/how-to/troubleshooting/stale-content', $this->alias($first));
    self::assertSame('/how-to/troubleshooting/stale-content-0', $this->alias($second));
    self::assertSame('/how-to/troubleshooting/stale-content-1', $this->alias($third));
    // Saving again keeps the number it has rather than taking the next.
    $second->save();
    self::assertSame('/how-to/troubleshooting/stale-content-0', $this->alias($second));
  }

  /**
   * A renamed issue's alias follows its title, and the old one redirects.
   */
  public function testARenameMovesTheAliasAndRedirectsTheOldOne(): void {
    $issue = $this->issue('Old title');
    $issue->setTitle('New title')->save();
    self::assertSame('/how-to/troubleshooting/new-title', $this->alias($issue));
    $redirects = $this->container->get('redirect.repository')->findBySourcePath('how-to/troubleshooting/old-title');
    self::assertCount(1, $redirects);
    self::assertSame('internal:/node/' . $issue->id(), reset($redirects)->get('redirect_redirect')->uri);
  }

  /**
   * Only issues are given an alias.
   */
  public function testAPageKeepsItsOwnAlias(): void {
    $storage = $this->container->get('entity_type.manager')->getStorage('node');
    $page = $storage->create(['type' => 'doc_page', 'title' => 'Troubleshooting', 'path' => ['alias' => '/how-to/troubleshooting']]);
    $page->save();
    self::assertSame('/how-to/troubleshooting', $this->alias($page));
  }

  /**
   * The search text is the title, the summary and the fix's visible blocks.
   *
   * Rich text is searched as the words a reader sees, not its markup, and a
   * block the editor has disabled is not searched at all.
   */
  public function testTheSearchTextHoldsTheTitleSummaryAndFix(): void {
    $hidden = Paragraph::create(['type' => 'docs_text', 'field_text' => ['value' => 'Hidden words', 'format' => 'plain_text']]);
    $hidden->setUnpublished();
    $issue = $this->issue('Blocked by CORS', 'The browser refuses the API.', [
      Paragraph::create(['type' => 'docs_text', 'field_text' => ['value' => "Set `cors.config`:", 'format' => 'plain_text']]),
      Paragraph::create(['type' => 'docs_code', 'field_code' => "allowedOrigins: ['*']"]),
      Paragraph::create(['type' => 'docs_rich_text', 'field_rich_text' => ['value' => '<p>Then <strong>rebuild</strong> caches.</p>', 'format' => 'plain_text']]),
      $hidden,
    ]);
    self::assertSame(
      "Blocked by CORS\nThe browser refuses the API.\nSet `cors.config`:\nallowedOrigins: ['*']\nThen rebuild caches.",
      $issue->get('field_issue_search_text')->value,
    );

    // Editing the fix changes the search text on the next save. The editor's
    // widget marks an edited block as needing a save, and only then is it
    // saved with the issue rather than reloaded.
    $block = $issue->get('field_content')->get(0)->entity;
    $block->set('field_text', ['value' => 'Changed', 'format' => 'plain_text']);
    $block->setNeedsSave(TRUE);
    $issue->save();
    self::assertStringContainsString("\nChanged\n", $issue->get('field_issue_search_text')->value);
  }

  /**
   * Nobody reads or writes the search text, so JSON:API leaves it out.
   *
   * It repeats the issue's other fields, which a response already carries,
   * and the view's search filter reads its table, not the field's access.
   */
  public function testTheSearchTextIsNotReadOrWritten(): void {
    $issue = $this->issue('Blocked by CORS');
    $admin = $this->container->get('entity_type.manager')->getStorage('user')->create(['uid' => 1, 'name' => 'admin']);
    $admin->save();
    self::assertFalse($issue->get('field_issue_search_text')->access('view', $admin));
    self::assertFalse($issue->get('field_issue_search_text')->access('edit', $admin));
    self::assertTrue($issue->get('field_description')->access('view', $admin));
  }

  /**
   * A saved issue.
   *
   * @param \Drupal\paragraphs\ParagraphInterface[] $fix
   *   The fix's blocks, in order.
   */
  private function issue(string $title, string $summary = '', array $fix = []): NodeInterface {
    $issue = $this->container->get('entity_type.manager')->getStorage('node')->create([
      'type' => 'docs_issue',
      'title' => $title,
      'field_description' => $summary,
      'field_content' => $fix,
    ]);
    $issue->save();
    return $issue;
  }

  /**
   * A node's alias as path_alias stores it.
   */
  private function alias(NodeInterface $node): string {
    $this->container->get('path_alias.manager')->cacheClear();
    return $this->container->get('path_alias.manager')->getAliasByPath('/node/' . $node->id());
  }

}
