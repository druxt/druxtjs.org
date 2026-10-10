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
   * Signs one payload on a site with the given settings and private key.
   */
  private function hashOn(array $settings, string $private_key): string {
    new Settings($settings);
    $state = $this->createMock(StateInterface::class);
    $state->method('get')->willReturn($private_key);
    $handler = new EncryptionHandler(new PrivateKey($state), $this->createMock(TimeInterface::class));
    return $handler->getHash('upload:data:533077c1:1760090000');
  }

}
