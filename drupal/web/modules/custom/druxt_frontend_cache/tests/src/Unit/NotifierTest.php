<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_frontend_cache\Unit;

use Drupal\Core\Site\Settings;
use Drupal\druxt_frontend_cache\Notifier;
use Drupal\Tests\UnitTestCase;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Psr7\Response;
use PHPUnit\Framework\MockObject\MockObject;
use Psr\Log\LoggerInterface;

/**
 * When the clear is sent, to whom, and what a refusal does.
 *
 * @coversDefaultClass \Drupal\druxt_frontend_cache\Notifier
 * @group druxt_frontend_cache
 */
final class NotifierTest extends UnitTestCase {

  /**
   * The HTTP client the notifier posts with.
   */
  private ClientInterface&MockObject $client;

  /**
   * The channel a failed clear is logged to.
   */
  private LoggerInterface&MockObject $logger;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->client = $this->createMock(ClientInterface::class);
    $this->logger = $this->createMock(LoggerInterface::class);
  }

  /**
   * A notifier over the given settings.
   */
  private function notifier(array $settings): Notifier {
    return new Notifier($this->client, new Settings($settings), $this->logger);
  }

  /**
   * @covers ::urls
   */
  public function testUrlsAreSplitTrimmedAndFallBackToTheFrontendUrl(): void {
    $notifier = $this->notifier([
      'druxt_frontend_cache' => ['url' => ' http://nuxt:3000/ , http://nuxt-2:3000'],
    ]);
    $this->assertSame(['http://nuxt:3000', 'http://nuxt-2:3000'], $notifier->urls());

    $fallback = $this->notifier(['druxt_docs_frontend_url' => 'https://druxtjs.org']);
    $this->assertSame(['https://druxtjs.org'], $fallback->urls());

    $this->assertSame([], $this->notifier([])->urls());
  }

  /**
   * @covers ::isConfigured
   */
  public function testNeedsBothAUrlAndASecret(): void {
    $this->assertFalse($this->notifier(['druxt_frontend_cache' => ['url' => 'http://nuxt:3000']])->isConfigured());
    $this->assertFalse($this->notifier(['druxt_frontend_cache' => ['secret' => 's']])->isConfigured());
    $this->assertTrue($this->notifier(['druxt_frontend_cache' => ['url' => 'http://nuxt:3000', 'secret' => 's']])->isConfigured());
  }

  /**
   * @covers ::flush
   */
  public function testNothingIsSentUntilSomethingChanged(): void {
    $notifier = $this->notifier(['druxt_frontend_cache' => ['url' => 'http://nuxt:3000', 'secret' => 's']]);
    $this->client->expects($this->never())->method('request');
    $this->assertTrue($notifier->flush());
  }

  /**
   * @covers ::markDirty
   * @covers ::flush
   */
  public function testOneClearPerFrontendWithTheSecretInTheHeader(): void {
    $notifier = $this->notifier(['druxt_frontend_cache' => ['url' => 'http://nuxt:3000,http://nuxt-2:3000', 'secret' => 'shared']]);
    $sent = [];
    $this->client->expects($this->exactly(2))->method('request')
      ->willReturnCallback(function (string $method, string $url, array $options) use (&$sent): Response {
        $sent[] = [$method, $url, $options['headers']['X-Druxt-Secret'] ?? NULL];
        return new Response(204);
      });
    $this->logger->expects($this->never())->method($this->anything());

    // However many changes a request makes, one clear goes out.
    $notifier->markDirty();
    $notifier->markDirty();
    $this->assertTrue($notifier->flush());
    $this->assertSame([
      ['POST', 'http://nuxt:3000' . Notifier::ENDPOINT, 'shared'],
      ['POST', 'http://nuxt-2:3000' . Notifier::ENDPOINT, 'shared'],
    ], $sent);

    // And nothing more until something changes again.
    $this->assertTrue($notifier->flush());
  }

  /**
   * @covers ::flush
   */
  public function testARefusedClearIsLoggedAndReportedAsFailed(): void {
    $notifier = $this->notifier(['druxt_frontend_cache' => ['url' => 'http://nuxt:3000', 'secret' => 'wrong']]);
    $this->client->method('request')->willReturn(new Response(401));
    $this->logger->expects($this->once())->method('warning')
      ->with($this->stringContains('answered @status'), $this->callback(fn (array $context): bool => $context['@status'] === 401 && $context['@url'] === 'http://nuxt:3000'));

    $notifier->markDirty();
    $this->assertFalse($notifier->flush());
  }

  /**
   * @covers ::flush
   */
  public function testAnUnreachableFrontendIsLoggedAndReportedAsFailed(): void {
    $notifier = $this->notifier(['druxt_frontend_cache' => ['url' => 'http://nuxt:3000', 'secret' => 's']]);
    $this->client->method('request')->willThrowException(new \RuntimeException('connection refused'));
    $this->logger->expects($this->once())->method('error')
      ->with($this->stringContains('Could not reach'), $this->callback(fn (array $context): bool => $context['@message'] === 'connection refused'));

    $notifier->markDirty();
    $this->assertFalse($notifier->flush());
  }

  /**
   * @covers ::flush
   */
  public function testAChangeWithNoFrontendConfiguredSendsNothingAndReportsFalse(): void {
    $notifier = $this->notifier([]);
    $this->client->expects($this->never())->method('request');
    $notifier->markDirty();
    $this->assertFalse($notifier->flush());
  }

}
