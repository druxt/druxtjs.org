<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Drush\Commands;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Site\Settings;
use Drupal\druxtjsorg\OAuthClient;
use Drupal\druxtjsorg\PreviewRegistrar;
use Drush\Attributes as CLI;
use Drush\Commands\AutowireTrait;
use Drush\Commands\DrushCommands;

/**
 * Keeps the frontend's OAuth consumers able to do what the frontend asks.
 *
 * One signs editors in, and one registers the frontend's preview target.
 */
final class DruxtjsorgCommands extends DrushCommands {

  use AutowireTrait;

  public function __construct(private readonly EntityTypeManagerInterface $entityTypeManager) {
    parent::__construct();
  }

  /**
   * Creates the frontend consumer, or sets its OAuth settings and callback.
   */
  #[CLI\Command(name: 'druxtjsorg:oauth-client')]
  #[CLI\Option(name: 'frontend', description: 'The frontend origin. Defaults to the druxt_docs_frontend_url setting.')]
  #[CLI\Usage(name: 'drush druxtjsorg:oauth-client', description: 'Allow this environment\'s frontend to sign editors in.')]
  public function oauthClient(array $options = ['frontend' => NULL]): int {
    $storage = $this->entityTypeManager->getStorage('consumer');
    $consumers = $storage->loadByProperties(['client_id' => OAuthClient::CLIENT_ID]);
    $consumer = reset($consumers) ?: $storage->create(OAuthClient::initial());

    $frontend = $options['frontend'] ?: Settings::get('druxt_docs_frontend_url');
    $redirects = array_column($consumer->get('redirect')->getValue(), 'value');
    foreach (OAuthClient::values($redirects, $frontend) as $field => $value) {
      $consumer->set($field, $value);
    }
    $consumer->save();

    $this->logger()->success(sprintf('%s signs in to %s.', OAuthClient::CLIENT_ID, implode(', ', array_column($consumer->get('redirect')->getValue(), 'value'))));
    return self::EXIT_SUCCESS;
  }

  /**
   * Creates the consumer the frontend registers its preview target on.
   *
   * The secret comes from the environment, never from an option, so it stays
   * out of the shell history and the deploy log. A copied database has
   * production's consumer with a sanitised secret, so every rollout sets it
   * again.
   */
  #[CLI\Command(name: 'druxtjsorg:preview-registrar')]
  #[CLI\Usage(name: 'drush druxtjsorg:preview-registrar', description: 'Let this environment\'s frontend register its preview target.')]
  public function previewRegistrar(): int {
    $users = $this->entityTypeManager->getStorage('user');
    $accounts = $users->loadByProperties(['name' => PreviewRegistrar::USER]);
    $account = reset($accounts) ?: $users->create(PreviewRegistrar::user());
    $account->addRole(PreviewRegistrar::ROLE);
    $account->activate();
    $account->save();

    $storage = $this->entityTypeManager->getStorage('consumer');
    $consumers = $storage->loadByProperties(['client_id' => PreviewRegistrar::CLIENT_ID]);
    $consumer = reset($consumers) ?: $storage->create(PreviewRegistrar::initial());
    foreach (PreviewRegistrar::values((int) $account->id()) as $field => $value) {
      $consumer->set($field, $value);
    }
    $secret = (string) getenv(PreviewRegistrar::SECRET_VARIABLE);
    if ($secret !== '') {
      $consumer->set('secret', $secret);
    }
    $consumer->save();

    if ($secret === '') {
      $this->logger()->warning(sprintf('%s is not set, so %s keeps the secret it has, and the frontend does not register its preview target.', PreviewRegistrar::SECRET_VARIABLE, PreviewRegistrar::CLIENT_ID));
    }
    else {
      $this->logger()->success(sprintf('The frontend can register its preview target on %s.', PreviewRegistrar::CLIENT_ID));
    }
    return self::EXIT_SUCCESS;
  }

}
