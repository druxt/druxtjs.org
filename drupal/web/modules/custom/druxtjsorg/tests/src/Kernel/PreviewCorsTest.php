<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\druxtjsorg\DruxtjsorgServiceProvider;
use Drupal\druxtjsorg\PreviewCors;
use Drupal\KernelTests\KernelTestBase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;

/**
 * The frontend's browser may ask for a preview with its token.
 */
#[CoversClass(DruxtjsorgServiceProvider::class)]
#[CoversClass(PreviewCors::class)]
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class PreviewCorsTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'file',
    'serialization',
    'jsonapi',
    'jsonapi_hypermedia',
    'druxtjsorg',
  ];

  /**
   * The environment's frontend, as settings.lagoon.php names it.
   */
  private const FRONTEND = 'https://frontend.example';

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->setSetting('druxt_docs_frontend_url', self::FRONTEND);
    $this->container->get('kernel')->rebuildContainer();
    $this->container = $this->container->get('kernel')->getContainer();
  }

  /**
   * A preflight for a GET with the token, as the frontend's browser sends it.
   */
  private function preflight(string $origin): array {
    $request = Request::create('/jsonapi', 'OPTIONS');
    $request->headers->set('Origin', $origin);
    $request->headers->set('Access-Control-Request-Method', 'GET');
    $request->headers->set('Access-Control-Request-Headers', 'accept,authorization');
    $headers = $this->container->get('http_kernel')->handle($request)->headers;
    return [
      'origin' => $headers->get('Access-Control-Allow-Origin'),
      'headers' => strtolower((string) $headers->get('Access-Control-Allow-Headers')),
      'credentials' => $headers->get('Access-Control-Allow-Credentials'),
    ];
  }

  /**
   * The frontend is answered, without credentials.
   */
  public function testTheFrontendMayAsk(): void {
    $answer = $this->preflight(self::FRONTEND);
    self::assertSame(self::FRONTEND, $answer['origin']);
    self::assertStringContainsString('authorization', $answer['headers']);
    self::assertNull($answer['credentials']);
  }

  /**
   * Any other site is not.
   *
   * The answer names only the frontend, which a browser on another origin
   * refuses.
   */
  public function testAnotherSiteMayNot(): void {
    $origin = $this->preflight('https://elsewhere.example')['origin'];
    self::assertNotSame('https://elsewhere.example', $origin);
    self::assertNotSame('*', $origin);
  }

}
