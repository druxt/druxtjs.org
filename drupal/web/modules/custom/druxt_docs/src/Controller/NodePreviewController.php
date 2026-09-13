<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Controller;

use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Url;
use Drupal\druxt_docs\PreviewUrl;
use Drupal\jsonapi\ResourceType\ResourceTypeRepositoryInterface;
use Drupal\node\Controller\NodePreviewController as CoreNodePreviewController;
use Drupal\node\NodeInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\Routing\Exception\RouteNotFoundException;

/**
 * Core's node preview as three tabs: the frontend, Drupal and JSON:API.
 */
final class NodePreviewController extends CoreNodePreviewController {

  /**
   * JSON:API's resource types, or NULL without JSON:API.
   */
  private ?ResourceTypeRepositoryInterface $resourceTypes = NULL;

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): static {
    $controller = parent::create($container);
    if ($container->has('jsonapi.resource_type.repository')) {
      $controller->resourceTypes = $container->get('jsonapi.resource_type.repository');
    }
    return $controller;
  }

  /**
   * {@inheritdoc}
   */
  public function view(EntityInterface $node_preview, $view_mode_id = 'full', $langcode = NULL): array {
    $drupal = parent::view($node_preview, $view_mode_id, $langcode);
    // HtmlRenderer reads page_top from the top of the main content only.
    $page_top = $drupal['#attached']['page_top'] ?? [];
    unset($drupal['#attached']['page_top']);
    return [
      '#theme' => 'druxt_docs_node_preview',
      '#title' => $node_preview->label(),
      '#drupal' => $drupal,
      '#frontend_url' => PreviewUrl::frontend((string) $node_preview->uuid(), $view_mode_id),
      '#jsonapi_url' => $node_preview instanceof NodeInterface ? $this->jsonApiUrl($node_preview) : NULL,
      '#attached' => [
        'library' => ['druxt_docs/node_preview'],
        'page_top' => $page_top,
      ],
    ];
  }

  /**
   * The JSON:API preview document's URL, including the node's paragraphs.
   */
  private function jsonApiUrl(NodeInterface $node): ?string {
    $resource_type = $this->resourceTypes?->get('node', $node->bundle());
    if ($resource_type === NULL || $resource_type->isInternal()) {
      return NULL;
    }
    $includes = [];
    foreach ($node->getFieldDefinitions() as $name => $definition) {
      if ($definition->getType() === 'entity_reference_revisions' && $resource_type->isFieldEnabled($name)) {
        $includes[] = $resource_type->getPublicName($name);
      }
    }
    try {
      return Url::fromRoute(
        'jsonapi.' . $resource_type->getTypeName() . '.individual.preview',
        ['node_preview' => $node->uuid()],
        $includes === [] ? [] : ['query' => ['include' => implode(',', $includes)]],
      )->toString();
    }
    catch (RouteNotFoundException) {
      return NULL;
    }
  }

}
