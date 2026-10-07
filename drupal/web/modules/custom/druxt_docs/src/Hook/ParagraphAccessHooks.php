<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Hook;

use Drupal\Core\Access\AccessResult;
use Drupal\Core\Access\AccessResultInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Session\AccountInterface;

/**
 * Lets a page's authors create its paragraphs over JSON:API.
 *
 * Paragraphs grants creation only inside an entity form: for any other
 * request format its access handler is neutral, so no permission can allow
 * a JSON:API POST. The documentation paragraph types belong to the page,
 * and whoever may create a page may create the paragraphs it is built from.
 */
final class ParagraphAccessHooks {

  /**
   * The paragraph types a documentation page is built from.
   */
  public const BUNDLES = [
    'docs_callout',
    'docs_code',
    'docs_diagram',
    'docs_image',
    'docs_layout_section',
    'docs_rich_text',
    'docs_text',
  ];

  /**
   * Implements hook_ENTITY_TYPE_create_access() for paragraphs.
   */
  #[Hook('paragraph_create_access')]
  public function createAccess(AccountInterface $account, array $context, ?string $entity_bundle): AccessResultInterface {
    if (!in_array($entity_bundle, self::BUNDLES, TRUE)) {
      return AccessResult::neutral();
    }
    return AccessResult::allowedIfHasPermission($account, 'create doc_page content');
  }

}
