<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\druxtjsorg\OAuthClient;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * What the frontend's consumer must be for its sign-in to work.
 */
#[CoversClass(OAuthClient::class)]
#[Group('druxtjsorg')]
final class OAuthClientTest extends UnitTestCase {

  /**
   * A public PKCE client that approves itself, for the editors' scopes.
   */
  public function testTheSignInSettings(): void {
    $values = OAuthClient::values([], NULL);
    self::assertFalse($values['confidential']);
    self::assertTrue($values['pkce']);
    self::assertTrue($values['automatic_authorization']);
    self::assertSame(['authorization_code', 'refresh_token'], $values['grant_types']);
    self::assertSame(['authenticated', 'editor', 'contributor', 'administrator'], $values['authorization_code_scopes']);
    self::assertSame([], $values['redirect']);
  }

  /**
   * The environment's callback is added to the ones already there, once.
   */
  public function testTheFrontendCallbackIsAddedOnce(): void {
    $existing = ['https://druxtjs.org/callback', 'http://localhost:3000/callback'];
    $values = OAuthClient::values($existing, 'https://dev.druxtjs.org/');
    self::assertSame([...$existing, 'https://dev.druxtjs.org/callback'], $values['redirect']);
    $again = OAuthClient::values($values['redirect'], 'https://dev.druxtjs.org');
    self::assertSame($values['redirect'], $again['redirect']);
  }

}
