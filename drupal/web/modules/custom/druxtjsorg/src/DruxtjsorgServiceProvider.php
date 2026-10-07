<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

use Drupal\Core\DependencyInjection\ContainerBuilder;
use Drupal\Core\DependencyInjection\ServiceProviderBase;

/**
 * Lets userinfo carry the account's picture and roles.
 *
 * Simple OAuth serves only the claims listed in this parameter, whatever the
 * alter hook adds.
 */
final class DruxtjsorgServiceProvider extends ServiceProviderBase {

  /**
   * The claims this module adds.
   */
  public const CLAIMS = ['picture', 'roles'];

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
