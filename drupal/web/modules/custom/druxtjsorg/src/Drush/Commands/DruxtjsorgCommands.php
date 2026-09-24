<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Drush\Commands;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Site\Settings;
use Drupal\druxtjsorg\OAuthClient;
use Drush\Attributes as CLI;
use Drush\Commands\AutowireTrait;
use Drush\Commands\DrushCommands;

/**
 * Keeps the frontend's OAuth consumer able to sign editors in.
 */
final class DruxtjsorgCommands extends DrushCommands {

  use AutowireTrait;

  public function __construct(private readonly EntityTypeManagerInterface $entityTypeManager) {
    parent::__construct();
  }

  /**
   * Sets the frontend consumer's OAuth settings and this frontend's callback.
   */
  #[CLI\Command(name: 'druxtjsorg:oauth-client')]
  #[CLI\Option(name: 'frontend', description: 'The frontend origin. Defaults to the druxt_docs_frontend_url setting.')]
  #[CLI\Usage(name: 'drush druxtjsorg:oauth-client', description: 'Allow this environment\'s frontend to sign editors in.')]
  public function oauthClient(array $options = ['frontend' => NULL]): int {
    $storage = $this->entityTypeManager->getStorage('consumer');
    $consumers = $storage->loadByProperties(['client_id' => OAuthClient::CLIENT_ID]);
    $consumer = reset($consumers);
    if (!$consumer) {
      $this->logger()->error(sprintf('No consumer has the client ID %s.', OAuthClient::CLIENT_ID));
      return self::EXIT_FAILURE;
    }

    $frontend = $options['frontend'] ?: Settings::get('druxt_docs_frontend_url');
    $redirects = array_column($consumer->get('redirect')->getValue(), 'value');
    foreach (OAuthClient::values($redirects, $frontend) as $field => $value) {
      $consumer->set($field, $value);
    }
    $consumer->save();

    $this->logger()->success(sprintf('%s signs in to %s.', OAuthClient::CLIENT_ID, implode(', ', array_column($consumer->get('redirect')->getValue(), 'value'))));
    return self::EXIT_SUCCESS;
  }

}
