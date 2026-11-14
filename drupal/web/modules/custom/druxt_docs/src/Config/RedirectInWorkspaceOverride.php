<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Config;

use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Config\ConfigFactoryOverrideInterface;
use Drupal\Core\Config\StorageInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Turns off the redirect module's redirect on an alias change in a workspace.
 *
 * The redirect module redirects a page's old alias to the page whenever the
 * alias changes, and a redirect can only be saved in Live. In a workspace,
 * that redirect would refuse the save that changed the alias, so a page or
 * troubleshooting issue could not be renamed there at all.
 *
 * Publishing the workspace saves the new alias in Live, and the redirect is
 * made then, which is also when the old alias stops working.
 */
final class RedirectInWorkspaceOverride implements ConfigFactoryOverrideInterface {

  /**
   * Whether the active workspace is being looked up, which can read config.
   */
  private bool $resolving = FALSE;

  public function __construct(
    private readonly ContainerInterface $container,
  ) {}

  /**
   * {@inheritdoc}
   */
  public function loadOverrides($names): array {
    if (!in_array('redirect.settings', $names, TRUE) || $this->workspace() === NULL) {
      return [];
    }
    return ['redirect.settings' => ['auto_redirect' => FALSE]];
  }

  /**
   * {@inheritdoc}
   */
  public function getCacheSuffix(): string {
    return 'druxt_docs_workspace=' . ($this->workspace() ?? 'live');
  }

  /**
   * {@inheritdoc}
   */
  public function createConfigObject($name, $collection = StorageInterface::DEFAULT_COLLECTION) {
    return NULL;
  }

  /**
   * {@inheritdoc}
   */
  public function getCacheableMetadata($name): CacheableMetadata {
    $metadata = new CacheableMetadata();
    if ($name === 'redirect.settings' && $this->container->has('workspaces.manager')) {
      $metadata->addCacheContexts(['workspace']);
    }
    return $metadata;
  }

  /**
   * The active workspace's id, or NULL in Live or without workspaces.
   */
  private function workspace(): ?string {
    if ($this->resolving || !$this->container->has('workspaces.manager')) {
      return NULL;
    }
    $this->resolving = TRUE;
    try {
      $manager = $this->container->get('workspaces.manager');
      return $manager->hasActiveWorkspace() ? $manager->getActiveWorkspace()->id() : NULL;
    }
    finally {
      $this->resolving = FALSE;
    }
  }

}
