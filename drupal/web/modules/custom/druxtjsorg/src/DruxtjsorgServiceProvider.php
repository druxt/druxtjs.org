<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\DependencyInjection\ServiceProviderBase;
use Drupal\Core\Session\AccountInterface;
use Drupal\druxtjsorg\Controller\WorkspaceEntityResource;
use Drupal\druxtjsorg\EventSubscriber\WorkspaceHeaderSubscriber;
use Drupal\druxtjsorg\Negotiator\CookieWorkspaceNegotiator;
use Drupal\druxtjsorg\Negotiator\HeaderWorkspaceNegotiator;
use Drupal\druxtjsorg\Revisions\LiveWorkingCopy;
use Drupal\druxtjsorg\Revisions\WorkspaceVersionNegotiator;
use Symfony\Component\DependencyInjection\Reference;

/**
 * Adds userinfo claims, and the workspace header's negotiator and subscriber.
 *
 * Simple OAuth serves only the claims listed in its parameter, whatever the
 * alter hook adds. The workspace services are registered only beside
 * Workspaces.
 */
final class DruxtjsorgServiceProvider extends ServiceProviderBase {

  /**
   * The claims this module adds.
   */
  public const CLAIMS = ['picture', 'roles'];

  /**
   * {@inheritdoc}
   */
  public function register(ContainerBuilder $container): void {
    if (!isset($container->getParameter('container.modules')['workspaces'])) {
      return;
    }
    $container->register('druxtjsorg.workspace_negotiator.header', HeaderWorkspaceNegotiator::class)
      ->addArgument(new Reference(AccountInterface::class))
      // Above core's query parameter (100) and session (50) negotiators.
      ->addTag('workspace_negotiator', ['priority' => 150]);
    $container->register('druxtjsorg.workspace_negotiator.cookie', CookieWorkspaceNegotiator::class)
      ->addArgument(new Reference(AccountInterface::class))
      // Below the header, above core's query parameter and session.
      ->addTag('workspace_negotiator', ['priority' => 140])
      ->addTag('event_subscriber');
    $container->register('druxtjsorg.workspace_header_subscriber', WorkspaceHeaderSubscriber::class)
      ->setArguments([
        new Reference(AccountInterface::class),
        new Reference('entity_type.manager'),
        new Reference('workspaces.manager'),
        new Reference('druxtjsorg.workspace_negotiator.header'),
        new Reference('druxtjsorg.workspace_negotiator.cookie'),
        new Reference('logger.factory'),
      ])
      ->addTag('event_subscriber');
    $container->register('druxtjsorg.live_working_copy', LiveWorkingCopy::class)
      ->setArguments([
        new Reference('entity_type.manager'),
        new Reference('workspaces.manager'),
        new Reference('workspaces.information'),
      ])
      ->setPublic(TRUE);
  }

  /**
   * {@inheritdoc}
   */
  public function alter(ContainerBuilder $container): void {
    if ($container->hasDefinition('druxtjsorg.workspace_negotiator.header') && $container->hasDefinition('jsonapi.entity_resource')) {
      $container->getDefinition('jsonapi.entity_resource')->setClass(WorkspaceEntityResource::class);
      $container->getDefinition('jsonapi.version_negotiator')->setClass(WorkspaceVersionNegotiator::class);
    }
    $this->swapFieldItemNormalizer($container);
    if (!$container->hasParameter('simple_oauth.openid.claims')) {
      return;
    }
    $claims = $container->getParameter('simple_oauth.openid.claims');
    $container->setParameter('simple_oauth.openid.claims', array_values(array_unique([...$claims, ...self::CLAIMS])));
  }

  /**
   * Swaps JSON:API's field item normalizer for the serialized-aware subclass.
   *
   * The serializer accepts only classes from JSON:API's own namespace, so the
   * subclass is lent one under src-impostor-normalizers, the pattern JSON:API
   * Resources and jsonapi_diff use.
   */
  private function swapFieldItemNormalizer(ContainerBuilder $container): void {
    $namespaces = $container->getParameter('container.namespaces');
    $modules = $container->getParameter('container.modules');
    $app_root = $container->getParameter('app.root');
    if (!is_array($namespaces) || !is_array($modules) || !is_string($app_root) || !isset($modules['druxtjsorg']['pathname']) || !$container->hasDefinition('serializer.normalizer.field_item.jsonapi')) {
      return;
    }
    $path = $app_root . '/' . dirname((string) $modules['druxtjsorg']['pathname']) . '/src-impostor-normalizers';
    $namespaces['Drupal\\jsonapi\\Normalizer\\ImpostorFrom\\druxtjsorg'][] = $path;
    $container->setParameter('container.namespaces', $namespaces);
    // The argument is set here rather than left to autowiring: Drupal 12
    // autowires this definition, and the impostor class is not resolvable
    // when that pass runs, so the normalizer was built with no arguments.
    $container->getDefinition('serializer.normalizer.field_item.jsonapi')
      ->setClass('Drupal\\jsonapi\\Normalizer\\ImpostorFrom\\druxtjsorg\\SerializedFieldItemNormalizerImpostor')
      ->setFile($path . '/SerializedFieldItemNormalizerImpostor.php')
      ->setArguments([new Reference('entity_type.manager')]);
  }

}
