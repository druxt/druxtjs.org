<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Unit;

use Drupal\druxtjsorg\PreviewCors;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * The frontend may read a preview with its token, and only the frontend.
 */
#[CoversClass(PreviewCors::class)]
#[Group('druxtjsorg')]
final class PreviewCorsTest extends UnitTestCase {

  /**
   * Core's default, which allows nothing until it is on.
   */
  private const CORE = [
    'enabled' => FALSE,
    'allowedHeaders' => [],
    'allowedMethods' => [],
    'allowedOrigins' => ['*'],
    'exposedHeaders' => FALSE,
    'maxAge' => FALSE,
    'supportsCredentials' => FALSE,
  ];

  /**
   * The frontend's origin, for GET with the token's header, no credentials.
   */
  public function testTheFrontendIsAllowed(): void {
    $cors = PreviewCors::config(self::CORE, 'https://druxtjs.org/');
    self::assertTrue($cors['enabled']);
    self::assertSame(['https://druxtjs.org'], $cors['allowedOrigins'], 'never every origin');
    self::assertSame(['GET'], $cors['allowedMethods']);
    self::assertSame(['accept', 'authorization'], $cors['allowedHeaders']);
    self::assertFalse($cors['supportsCredentials'], 'a page elsewhere never reads with the editor\'s session');
    self::assertFalse($cors['maxAge']);
  }

  /**
   * An origin keeps its port, and loses its path.
   */
  public function testTheOriginIsTheFrontendsOrigin(): void {
    self::assertSame(['http://127.0.0.1:3000'], PreviewCors::config(self::CORE, 'http://127.0.0.1:3000/docs')['allowedOrigins']);
  }

  /**
   * A site that turned CORS on keeps what it allowed.
   */
  public function testSiteSettingsStay(): void {
    $site = array_merge(self::CORE, [
      'enabled' => TRUE,
      'allowedOrigins' => ['https://example.com'],
      'allowedMethods' => ['GET', 'POST'],
      'allowedHeaders' => ['Content-Type'],
      'supportsCredentials' => TRUE,
    ]);
    $cors = PreviewCors::config($site, 'https://druxtjs.org');
    self::assertSame(['https://example.com', 'https://druxtjs.org'], $cors['allowedOrigins']);
    self::assertSame(['GET', 'POST'], $cors['allowedMethods']);
    self::assertSame(['content-type', 'accept', 'authorization'], $cors['allowedHeaders']);
    self::assertTrue($cors['supportsCredentials']);
  }

  /**
   * Without a frontend URL, or with one that is not one, nothing changes.
   */
  public function testNoFrontendChangesNothing(): void {
    foreach ([NULL, '', 'druxtjs.org', 'ftp://druxtjs.org'] as $frontend) {
      self::assertSame(self::CORE, PreviewCors::config(self::CORE, $frontend), var_export($frontend, TRUE));
    }
  }

}
