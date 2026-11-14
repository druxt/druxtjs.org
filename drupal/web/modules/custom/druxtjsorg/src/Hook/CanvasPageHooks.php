<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\block\Entity\Block;
use Drupal\Core\Access\AccessResult;
use Drupal\Core\Access\AccessResultInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Routing\RouteMatchInterface;
use Drupal\Core\Session\AccountInterface;

/**
 * A Canvas page in Drupal looks as the frontend renders it.
 *
 * The frontend renders a Canvas page's components and nothing else: the
 * page's title is its name in Drupal, not a heading on the page. So Drupal
 * leaves its page title block off a Canvas page, in Canvas's editor too.
 */
final class CanvasPageHooks {

  public function __construct(private readonly RouteMatchInterface $routeMatch) {}

  /**
   * Implements hook_block_access().
   */
  #[Hook('block_access')]
  public function blockAccess(Block $block, string $operation, AccountInterface $account): AccessResultInterface {
    if ($operation !== 'view' || $block->getPluginId() !== 'page_title_block') {
      return AccessResult::neutral();
    }
    // The page's own route, or one of the editor's, which name the entity
    // type beside the entity.
    $canvas = $this->routeMatch->getParameter('canvas_page') !== NULL
      || $this->routeMatch->getParameter('entity_type') === 'canvas_page';
    return AccessResult::forbiddenIf($canvas)->addCacheContexts(['route']);
  }

}
