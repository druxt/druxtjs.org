<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\PrivateKey;
use Drupal\Core\Site\Settings;
use Drupal\Core\State\StateInterface;
use Drupal\Tests\UnitTestCase;
use Drupal\wse_deploy\EncryptionHandler;
use PHPUnit\Framework\Attributes\Group;

/**
 * A deploy pair signs with its shared key and keeps its own hash salts.
 *
 * Covers the site's patch to the Workspaces Deploy encryption handler.
 */
#[Group('druxtjsorg')]
final class WseDeployKeySigningTest extends UnitTestCase {

  private const DATA = 'upload:data:533077c1:1760090000';

  /**
   * Two environments with one key and different salts accept each other.
   */
  public function testSharedKeySignsAcrossDifferentSalts(): void {
    $source = $this->hashOn(['hash_salt' => 'source-salt', 'wse_deploy.hash.key' => 'shared'], 'source-private');
    $target = $this->hashOn(['hash_salt' => 'target-salt', 'wse_deploy.hash.key' => 'shared'], 'target-private');
    self::assertSame($source, $target);
  }

  /**
   * Without a key, a different salt or private key still breaks the pair.
   */
  public function testWithoutKeyTheSaltStillSigns(): void {
    $source = $this->hashOn(['hash_salt' => 'source-salt'], 'private');
    $target = $this->hashOn(['hash_salt' => 'target-salt'], 'private');
    self::assertNotSame($source, $target);
  }

  /**
   * Another key is refused.
   */
  public function testAnotherKeyIsRefused(): void {
    $source = $this->hashOn(['hash_salt' => 'salt', 'wse_deploy.hash.key' => 'one'], 'private');
    $target = $this->hashOn(['hash_salt' => 'salt', 'wse_deploy.hash.key' => 'two'], 'private');
    self::assertNotSame($source, $target);
  }

  /**
   * Staging accepts the local key and signs with production's.
   *
   * A chain of three: local signs with A, staging accepts A and signs with
   * B, production accepts B alone.
   */
  public function testChainAcceptsKeyBeforeItAndRefusesItsOwn(): void {
    $local = ['hash_salt' => 'l', 'wse_deploy.hash.key' => 'A'];
    $staging = ['hash_salt' => 's', 'wse_deploy.hash.key' => 'B', 'wse_deploy.hash.accept_key' => 'A'];
    $production = ['hash_salt' => 'p', 'wse_deploy.hash.accept_key' => 'B'];

    $from_local = $this->hashOn($local, 'private');
    self::assertTrue($this->verifiesOn($staging, $from_local));
    self::assertFalse($this->verifiesOn($production, $from_local));

    $from_staging = $this->hashOn($staging, 'private');
    self::assertTrue($this->verifiesOn($production, $from_staging));
    self::assertFalse($this->verifiesOn($staging, $from_staging));
  }

  /**
   * Without an accept key, a site accepts what it signs itself.
   */
  public function testWithoutAcceptKeySiteAcceptsItsOwnKey(): void {
    $site = ['hash_salt' => 'salt', 'wse_deploy.hash.key' => 'shared'];
    self::assertTrue($this->verifiesOn($site, $this->hashOn($site, 'private')));
    self::assertFalse($this->verifiesOn($site, $this->hashOn(['hash_salt' => 'salt', 'wse_deploy.hash.key' => 'other'], 'private')));
  }

  /**
   * Whether a hash made elsewhere verifies on a site with the given settings.
   */
  private function verifiesOn(array $settings, string $hash): bool {
    return $this->handlerOn($settings, 'private')->validateHash(self::DATA, $hash);
  }

  /**
   * Signs one payload on a site with the given settings and private key.
   */
  private function hashOn(array $settings, string $private_key): string {
    return $this->handlerOn($settings, $private_key)->getHash(self::DATA);
  }

  /**
   * The module's handler on a site with the given settings and private key.
   */
  private function handlerOn(array $settings, string $private_key): EncryptionHandler {
    new Settings($settings);
    $state = $this->createMock(StateInterface::class);
    $state->method('get')->willReturn($private_key);
    return new EncryptionHandler(new PrivateKey($state), $this->createMock(TimeInterface::class));
  }

}
