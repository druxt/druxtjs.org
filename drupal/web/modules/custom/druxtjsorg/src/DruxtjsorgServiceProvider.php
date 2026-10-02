<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\DependencyInjection\ServiceProviderBase;
use Drupal\Core\Session\AccountInterface;
use Drupal\druxtjsorg\Negotiator\HeaderWorkspaceNegotiator;
use Symfony\Component\DependencyInjection\Reference;

/**
 * Adds userinfo claims, and the workspace header negotiator.
 *
 * Simple OAuth serves only the claims listed in its parameter, whatever the
 * alter hook adds. The negotiator is registered only beside Workspaces.
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
  }

  /**
   * {@inheritdoc}
   */
  public function alter(ContainerBuilder $container): void {
    if (!$container->hasParameter('simple_oauth.openid.claims')) {
      return;
    }
    $claims = $container->getParameter('simple_oauth.openid.claims');
    $container->setParameter('simple_oauth.openid.claims', array_values(array_unique([...$claims, ...self::CLAIMS])));
  }

}
