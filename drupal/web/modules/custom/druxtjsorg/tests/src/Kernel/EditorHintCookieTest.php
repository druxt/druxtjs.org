<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\druxtjsorg\EventSubscriber\EditorHintSubscriber;
use Drupal\KernelTests\KernelTestBase;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Request;

/**
 * The cookie that tells the frontend a signed-in user may be looking.
 */
#[CoversClass(EditorHintSubscriber::class)]
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class EditorHintCookieTest extends KernelTestBase {

  use UserCreationTrait;

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
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installConfig(['system', 'user']);
    // Uid 1 bypasses every access check, so it is spent here.
    $this->createUser();
  }

  /**
   * A signed-in user is given the hint, readable by the frontend's script.
   */
  public function testASignedInUserIsGivenTheHint(): void {
    $this->setCurrentUser($this->createUser());
    $cookie = $this->hint($this->request());
    self::assertNotNull($cookie);
    self::assertSame('1', $cookie->getValue());
    self::assertFalse($cookie->isHttpOnly());
    self::assertSame('/', $cookie->getPath());
  }

  /**
   * A signed-in user who already has it is not sent it again.
   */
  public function testTheHintIsNotResentToAUserWhoHasIt(): void {
    $this->setCurrentUser($this->createUser());
    self::assertNull($this->hint($this->request(TRUE)));
  }

  /**
   * An anonymous visitor who still carries it has it cleared.
   */
  public function testAnAnonymousVisitorHasAStaleHintCleared(): void {
    $cookie = $this->hint($this->request(TRUE));
    self::assertNotNull($cookie);
    self::assertTrue($cookie->isCleared());
  }

  /**
   * An anonymous visitor without it is sent nothing.
   */
  public function testAnAnonymousVisitorIsSentNothing(): void {
    self::assertNull($this->hint($this->request()));
  }

  /**
   * A request for a page, with or without the hint.
   */
  private function request(bool $with_hint = FALSE): Request {
    $request = Request::create('/user/login_status', 'GET', ['_format' => 'json']);
    if ($with_hint) {
      $request->cookies->set(EditorHintSubscriber::COOKIE, '1');
    }
    return $request;
  }

  /**
   * The hint cookie the response sets, if any.
   */
  private function hint(Request $request): ?Cookie {
    $response = $this->container->get('http_kernel')->handle($request);
    foreach ($response->headers->getCookies() as $cookie) {
      if ($cookie->getName() === EditorHintSubscriber::COOKIE) {
        return $cookie;
      }
    }
    return NULL;
  }

}
