<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\druxtjsorg\PreviewRegistrar;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * What the frontend's consumer must be for it to register its preview target.
 */
#[CoversClass(PreviewRegistrar::class)]
#[Group('druxtjsorg')]
final class PreviewRegistrarTest extends UnitTestCase {

  /**
   * A confidential client with only the client credentials grant and scope.
   */
  public function testTheRegistrationSettings(): void {
    $values = PreviewRegistrar::values(7);
    self::assertTrue($values['confidential'], 'the token request sends a secret');
    self::assertSame(['client_credentials'], $values['grant_types']);
    self::assertSame(['preview_targets'], $values['scopes']);
    self::assertFalse($values['is_default'], 'never the consumer a request without one falls back to');
  }

  /**
   * The token acts as the registrar, who owns the consumer.
   */
  public function testTheRegistrarIsTheUserAndTheOwner(): void {
    $values = PreviewRegistrar::values(7);
    self::assertSame(7, $values['user_id']);
    // Consumer Node Preview changes only the targets of a consumer the user
    // owns.
    self::assertSame(7, $values['owner_id']);
  }

  /**
   * A new consumer and user are the ones the frontend and the scope name.
   */
  public function testNewConsumerAndUser(): void {
    self::assertSame('druxtjs_org_preview', PreviewRegistrar::initial()['client_id']);
    self::assertSame('frontend_registrar', PreviewRegistrar::user()['name']);
    self::assertSame(1, PreviewRegistrar::user()['status']);
    self::assertStringEndsWith('.invalid', PreviewRegistrar::user()['mail']);
  }

}
