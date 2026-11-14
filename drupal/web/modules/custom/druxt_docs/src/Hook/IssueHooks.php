<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Hook;

use Drupal\Core\Access\AccessResult;
use Drupal\Core\Access\AccessResultInterface;
use Drupal\Core\Entity\EntityPublishedInterface;
use Drupal\Core\Field\FieldDefinitionInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Session\AccountInterface;
use Drupal\node\NodeInterface;

/**
 * Gives each troubleshooting issue its search text on save.
 *
 * An issue's URL is its alias, which pathauto's docs_issue pattern makes
 * from its title under the troubleshooting page's path.
 *
 * The page's search matches every word of a query against an issue's title,
 * summary and fix. Its fix is paragraphs, which Views cannot search as one
 * text, so the text is kept on the issue and rebuilt on every save. Only the
 * view's filter reads it, so it is kept out of every response.
 */
final class IssueHooks {

  /**
   * The issue node type.
   */
  public const BUNDLE = 'docs_issue';

  /**
   * The field the search text is kept in.
   */
  private const SEARCH_TEXT = 'field_issue_search_text';

  /**
   * The text field of each block type a fix is built from, and whether it
   * holds markup, which is searched as the words a reader sees.
   */
  private const TEXT = [
    'docs_text' => ['field_text', FALSE],
    'docs_code' => ['field_code', FALSE],
    'docs_callout' => ['field_callout', TRUE],
    'docs_rich_text' => ['field_rich_text', TRUE],
  ];

  /**
   * Implements hook_ENTITY_TYPE_presave() for nodes.
   */
  #[Hook('node_presave')]
  public function nodePresave(NodeInterface $node): void {
    if ($node->bundle() !== self::BUNDLE) {
      return;
    }
    if ($node->hasField(self::SEARCH_TEXT)) {
      $node->set(self::SEARCH_TEXT, $this->searchText($node));
    }
  }

  /**
   * Implements hook_entity_field_access().
   *
   * The search text repeats the issue's other fields, so nobody reads it and
   * only the presave hook writes it.
   */
  #[Hook('entity_field_access')]
  public function entityFieldAccess(string $operation, FieldDefinitionInterface $field_definition, AccountInterface $account): AccessResultInterface {
    return $field_definition->getName() === self::SEARCH_TEXT && $field_definition->getTargetEntityTypeId() === 'node'
      ? AccessResult::forbidden('The search text is for the troubleshooting view\'s filter only.')
      : AccessResult::neutral();
  }

  /**
   * The issue's title, summary and fix as one text, a line per part.
   */
  private function searchText(NodeInterface $node): string {
    $parts = [$node->label() ?? ''];
    if ($node->hasField('field_description')) {
      $parts[] = (string) $node->get('field_description')->value;
    }
    if ($node->hasField('field_content')) {
      foreach ($node->get('field_content') as $item) {
        $paragraph = $item->entity;
        if ($paragraph === NULL || ($paragraph instanceof EntityPublishedInterface && !$paragraph->isPublished())) {
          continue;
        }
        [$field, $markup] = self::TEXT[$paragraph->bundle()] ?? [NULL, FALSE];
        if ($field === NULL || !$paragraph->hasField($field)) {
          continue;
        }
        $text = (string) $paragraph->get($field)->value;
        $parts[] = $markup ? html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5) : $text;
      }
    }
    return implode("\n", array_filter(array_map('trim', $parts), fn (string $part): bool => $part !== ''));
  }

}
