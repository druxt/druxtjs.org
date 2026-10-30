<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Controller;

use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityRepositoryInterface;
use Drupal\Core\Http\Exception\CacheableAccessDeniedHttpException;
use Drupal\Core\Http\Exception\CacheableNotFoundHttpException;
use Drupal\Core\Language\LanguageInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\TempStore\PrivateTempStoreFactory;
use Drupal\Core\Url;
use Drupal\jsonapi\CacheableResourceResponse;
use Drupal\jsonapi\JsonApiResource\IncludedData;
use Drupal\jsonapi\JsonApiResource\JsonApiDocumentTopLevel;
use Drupal\jsonapi\JsonApiResource\Link;
use Drupal\jsonapi\JsonApiResource\LinkCollection;
use Drupal\jsonapi\JsonApiResource\ResourceObjectData;
use Drupal\jsonapi\ResourceType\ResourceType;
use Drupal\jsonapi_diff\Access\EntityViewCheck;
use Drupal\jsonapi_diff\Comparison\EntityDiff;
use Drupal\jsonapi_diff\Comparison\TreeBuilder;
use Drupal\jsonapi_diff\JsonApiResource\DiffResourceObject;
use Drupal\jsonapi_diff\RevisionPairResolver;
use Drupal\jsonapi_resources\Resource\ResourceBase;
use Drupal\workspaces\WorkspaceManagerInterface;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Route;

/**
 * The editor's unsaved node preview, compared with the live page.
 *
 * The jsonapi_diff module compares two saved revisions. A preview is not
 * one: it is the node form's entity, held in the node_preview private
 * tempstore for the editor who pressed Preview. This serves the same
 * document as jsonapi_diff's own resource, with that entity on the right.
 *
 * The left side is resolved and access checked by jsonapi_diff's resolver,
 * from `leftVersion`, or the live revision when it is absent. The right side
 * is the editor's own preview, so it is only ever theirs to read, and the
 * response is never cached.
 *
 * The document's own `self` link is the one jsonapi_diff's resource object
 * builds, to jsonapi_diff's route, which cannot read `preview:current`.
 * Nothing follows it. It lives here until jsonapi_diff can name a preview as
 * a version itself, which also fixes the link.
 */
final class PreviewDiffResource extends ResourceBase implements ContainerInjectionInterface {

  /**
   * The version the document names for the right side.
   */
  public const string RIGHT_VERSION = 'preview:current';

  public function __construct(
    private readonly RevisionPairResolver $revisionPairResolver,
    private readonly TreeBuilder $treeBuilder,
    private readonly EntityViewCheck $entityViewCheck,
    private readonly EntityRepositoryInterface $entityRepository,
    private readonly LanguageManagerInterface $languageManager,
    private readonly PrivateTempStoreFactory $tempStoreFactory,
    private readonly ?WorkspaceManagerInterface $workspaceManager = NULL,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): self {
    return new self(
      $container->get('jsonapi_diff.revision_pair_resolver'),
      $container->get('jsonapi_diff.tree_builder'),
      $container->get('jsonapi_diff.entity_view_check'),
      $container->get('entity.repository'),
      $container->get('language_manager'),
      $container->get('tempstore.private'),
      $container->has('workspaces.manager') ? $container->get('workspaces.manager') : NULL,
    );
  }

  /**
   * Processes the request.
   *
   * @param \Symfony\Component\HttpFoundation\Request $request
   *   The request. `leftVersion` is read from its query.
   * @param \Drupal\jsonapi\ResourceType\ResourceType[] $resource_types
   *   The route resource types. Only the diff type.
   * @param string $entity_type
   *   The entity type id from the path.
   * @param string $bundle
   *   The bundle from the path.
   * @param string $uuid
   *   The entity UUID from the path, which is also the preview's key.
   *
   * @return \Drupal\jsonapi\CacheableResourceResponse
   *   The response.
   */
  public function process(Request $request, array $resource_types, string $entity_type, string $bundle, string $uuid): CacheableResourceResponse {
    $diff_type = reset($resource_types);
    if (!$diff_type instanceof ResourceType) {
      throw new \LogicException('The preview diff route defines exactly one resource type.');
    }
    // A preview belongs to one editor and changes each time they press
    // Preview, so no answer is reused.
    $cacheability = (new CacheableMetadata())
      ->addCacheContexts(['user', 'url.query_args:leftVersion', 'languages:language_content'])
      ->setCacheMaxAge(0);

    // One answer for an unknown type, a page with nothing live and a page
    // this editor has no preview of, so the answer says nothing about
    // anyone else's.
    $not_found = new CacheableNotFoundHttpException($cacheability, sprintf('No preview of a `%s--%s` resource with the UUID `%s` was found.', $entity_type, $bundle, $uuid));
    // The type is checked before anything is loaded by it: loading an entity
    // of a type the site does not have throws, rather than finding nothing.
    $resource_type = $this->resourceTypeRepository->get($entity_type, $bundle);
    if (!$resource_type instanceof ResourceType || $resource_type->isInternal() || !$resource_type->isVersionable()) {
      throw $not_found;
    }
    $entity = $this->entityRepository->loadEntityByUuid($entity_type, $uuid);
    $preview = $this->preview($uuid);
    if (!$entity instanceof ContentEntityInterface || $entity->bundle() !== $bundle
      || !$preview instanceof ContentEntityInterface || $preview->uuid() !== $entity->uuid()) {
      throw $not_found;
    }

    // The left side is the live revision: the page as its readers see it. In
    // a workspace, loading the page gives the workspace's own revision, and
    // an edit saved there would not show against it, so live is loaded
    // outside the workspace. A page the workspace created has nothing live.
    $live = $this->workspaceManager
      ? $this->workspaceManager->executeOutsideWorkspace(fn () => $this->entityRepository->loadEntityByUuid($entity_type, $uuid))
      : $entity;
    if (!$live instanceof ContentEntityInterface) {
      throw $not_found;
    }
    $left = $request->query->get('leftVersion');
    $left = $left === NULL ? 'id:' . $live->getRevisionId() : (string) $left;
    $pair = $this->revisionPairResolver->resolve($entity, $left, $left);
    if (!$this->entityViewCheck->isViewable($preview, $pair->account, $cacheability)) {
      throw new CacheableAccessDeniedHttpException($cacheability, 'The current user is not allowed to view the preview.');
    }

    $tree = $this->treeBuilder->build($pair->left, $preview, $pair->account);
    $language = $this->languageManager->getCurrentLanguage(LanguageInterface::TYPE_CONTENT);
    $root = new DiffResourceObject($diff_type, $resource_type, $tree, $pair->leftVersion, self::RIGHT_VERSION, $language);
    $included = [];
    $this->collectIncluded($diff_type, $tree, $language, $included);
    $links = new LinkCollection([
      'self' => new Link(new CacheableMetadata(), Url::fromUri($request->getUri()), 'self'),
    ]);
    $document = new JsonApiDocumentTopLevel(new ResourceObjectData([$root], 1), new IncludedData($included), $links);
    $response = new CacheableResourceResponse($document);
    $response->addCacheableDependency($pair->cacheability)
      ->addCacheableDependency($tree->cacheability)
      // Last, so its max-age of 0 is the one that stands.
      ->addCacheableDependency($cacheability);
    return $response;
  }

  /**
   * {@inheritdoc}
   */
  public function getRouteResourceTypes(Route $route, string $route_name): array {
    $versionable = array_values(array_filter(
      $this->resourceTypeRepository->all(),
      static fn (ResourceType $resource_type): bool => $resource_type->isVersionable() && !$resource_type->isInternal(),
    ));
    return [DiffResourceObject::resourceType($versionable)];
  }

  /**
   * The current editor's unsaved preview of an entity, if they have one.
   *
   * The node form keeps it in the node_preview tempstore under the entity's
   * UUID, as core's node_preview route parameter reads it.
   *
   * @see \Drupal\node\ParamConverter\NodePreviewConverter
   */
  private function preview(string $uuid): ?ContentEntityInterface {
    $form_state = $this->tempStoreFactory->get('node_preview')->get($uuid);
    if (!$form_state) {
      return NULL;
    }
    $entity = $form_state->getFormObject()->getEntity();
    return $entity instanceof ContentEntityInterface ? $entity : NULL;
  }

  /**
   * Adds the diff resource objects of a tree's children to `included`.
   *
   * As jsonapi_diff's own resource does: children in tree order, each
   * followed by its own, and each side named by its revision id.
   *
   * @see \Drupal\jsonapi_diff\Resource\DiffResource::collectIncluded()
   */
  private function collectIncluded(ResourceType $diff_type, EntityDiff $diff, LanguageInterface $language, array &$included): void {
    foreach ($diff->children as $child) {
      $entity_type = $this->resourceTypeRepository->get($child->diff->entityTypeId, $child->diff->bundle);
      if (!$entity_type instanceof ResourceType || $entity_type->isInternal()) {
        continue;
      }
      $included[] = new DiffResourceObject(
        $diff_type,
        $entity_type,
        $child->diff,
        $child->diff->leftRevisionId === NULL ? NULL : 'id:' . $child->diff->leftRevisionId,
        $child->diff->rightRevisionId === NULL ? NULL : 'id:' . $child->diff->rightRevisionId,
        $language,
      );
      $this->collectIncluded($diff_type, $child->diff, $language, $included);
    }
  }

}
