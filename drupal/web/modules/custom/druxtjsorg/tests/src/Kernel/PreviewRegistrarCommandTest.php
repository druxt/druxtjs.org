<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\Component\Serialization\Yaml;
use Drupal\consumers\Entity\Consumer;
use Drupal\druxtjsorg\Drush\Commands\DruxtjsorgCommands;
use Drupal\druxtjsorg\PreviewRegistrar;
use Drupal\KernelTests\KernelTestBase;
use Drush\Log\DrushLoggerManager;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The rollout gives the frontend a consumer to register its preview target on.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class PreviewRegistrarCommandTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'file',
    'image',
    'options',
    'node',
    'serialization',
    'jsonapi',
    'jsonapi_hypermedia',
    'entity_reference_revisions',
    'paragraphs',
    'workspaces',
    'workspaces_ui',
    'wse',
    'consumers',
    'simple_oauth',
    'jsonapi_node_preview',
    'consumer_node_preview',
    'druxtjsorg',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('workspace');
    $this->installEntitySchema('consumer');
    $this->installEntitySchema('oauth2_token');
    $this->installConfig(['user', 'simple_oauth']);
    // The role and scope as the site ships them, so the test reads the files
    // a config import would.
    $sync = DRUPAL_ROOT . '/../config/sync';
    $shipped = [
      'user_role' => 'user.role.preview_target_registrar',
      'oauth2_scope' => 'simple_oauth.oauth2_scope.preview_targets',
    ];
    foreach ($shipped as $type => $name) {
      $this->container->get('entity_type.manager')->getStorage($type)
        ->create(Yaml::decode(file_get_contents("$sync/$name.yml")))
        ->save();
    }
  }

  /**
   * Runs the command, with or without the secret in the environment.
   */
  private function rollout(?string $secret): void {
    putenv(PreviewRegistrar::SECRET_VARIABLE . ($secret === NULL ? '' : "=$secret"));
    $command = new DruxtjsorgCommands($this->container->get('entity_type.manager'));
    $command->setLogger(new DrushLoggerManager());
    self::assertSame(0, $command->previewRegistrar());
  }

  /**
   * Loads the consumer the command made.
   */
  private function consumer(): Consumer {
    $consumers = $this->container->get('entity_type.manager')->getStorage('consumer')
      ->loadByProperties(['client_id' => PreviewRegistrar::CLIENT_ID]);
    self::assertCount(1, $consumers);
    return reset($consumers);
  }

  /**
   * {@inheritdoc}
   */
  protected function tearDown(): void {
    putenv(PreviewRegistrar::SECRET_VARIABLE);
    parent::tearDown();
  }

  /**
   * A site with neither gets the registrar, and a consumer it owns and acts as.
   */
  public function testTheConsumerAndTheRegistrar(): void {
    $this->rollout('first-secret');
    $consumer = $this->consumer();
    $accounts = $this->container->get('entity_type.manager')->getStorage('user')
      ->loadByProperties(['name' => PreviewRegistrar::USER]);
    $account = reset($accounts);
    self::assertNotFalse($account);
    self::assertTrue($account->isActive());
    self::assertSame(['authenticated', PreviewRegistrar::ROLE], $account->getRoles());
    self::assertTrue($account->hasPermission('register consumer node preview targets'));
    self::assertSame((int) $account->id(), (int) $consumer->get('user_id')->target_id);
    self::assertSame((int) $account->id(), (int) $consumer->getOwnerId());
    self::assertTrue((bool) $consumer->get('confidential')->value);
    self::assertSame(['client_credentials'], array_column($consumer->get('grant_types')->getValue(), 'value'));
    self::assertSame([PreviewRegistrar::SCOPE], array_column($consumer->get('scopes')->getValue(), 'scope_id'));
    // Simple OAuth 6 refuses a consumer without its required fields, as the
    // default consumer found.
    self::assertCount(0, $consumer->validate());
    // Stored hashed, and it matches the variable.
    $hash = (string) $consumer->get('secret')->value;
    self::assertNotSame('first-secret', $hash);
    self::assertTrue($this->container->get('password')->check('first-secret', $hash));
  }

  /**
   * Every rollout sets the secret again, and makes nothing twice.
   */
  public function testRolloutReplacesSanitisedSecret(): void {
    $this->rollout('first-secret');
    $id = $this->consumer()->id();
    // What the sanitise leaves on a copied database.
    $this->consumer()->set('secret', 'sanitised-' . PreviewRegistrar::CLIENT_ID)->save();
    $this->rollout('environment-secret');
    $consumer = $this->consumer();
    self::assertSame($id, $consumer->id());
    self::assertTrue($this->container->get('password')->check('environment-secret', (string) $consumer->get('secret')->value));
    self::assertCount(1, $this->container->get('entity_type.manager')->getStorage('user')
      ->loadByProperties(['name' => PreviewRegistrar::USER]));
  }

  /**
   * Without the variable the consumer keeps the secret it has.
   */
  public function testNoVariableKeepsTheSecret(): void {
    $this->rollout('first-secret');
    $this->rollout(NULL);
    self::assertTrue($this->container->get('password')->check('first-secret', (string) $this->consumer()->get('secret')->value));
  }

  /**
   * The targets a registration wrote stay through a rollout.
   */
  public function testRolloutKeepsRegisteredTargets(): void {
    $this->rollout('first-secret');
    $target = [
      'label' => 'druxtjs.org',
      'url' => 'https://druxtjs.org/druxt/node/preview?vm=[view_mode]&layout=[layout]#[jsonapi_node_preview_path]',
    ];
    $this->consumer()->set('preview_targets', [$target])->save();
    $this->rollout('first-secret');
    self::assertSame([$target], $this->consumer()->get('preview_targets')->getValue());
  }

}
