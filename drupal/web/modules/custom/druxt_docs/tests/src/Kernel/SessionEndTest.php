<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\Core\Access\CsrfRequestHeaderAccessCheck;
use Drupal\druxt_docs\Controller\SessionController;
use Drupal\KernelTests\KernelTestBase;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;

/**
 * Ending a session the frontend did not start.
 *
 * Core's JSON logout wants the token issued at login, so only the session that
 * logged in can end itself. This route ends whichever session the request
 * carries, and is protected by the header token `/session/token` issues rather
 * than by that one.
 */
#[CoversClass(SessionController::class)]
#[Group('druxt_docs')]
#[RunTestsInSeparateProcesses]
final class SessionEndTest extends KernelTestBase {

  use UserCreationTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    // druxt_docs' frontend redirect subscriber takes path_alias.manager, and a
    // kernel test builds the whole container, subscribers it never fires too.
    'path_alias',
    'druxt_docs',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('path_alias');
    $this->installConfig(['system', 'user']);
    // Uid 1 bypasses every access check, so it is spent here.
    $this->createUser();
  }

  /**
   * The request, with the header token unless one is refused.
   */
  private function request(bool $withToken = TRUE): Request {
    $request = Request::create('/druxt-docs/session', 'DELETE');
    // Core applies the header check only to a request that carries a session
    // cookie. Without one here the check would pass itself over and every
    // assertion below would hold whether or not the route were protected.
    $name = $this->container->get('session_configuration')->getOptions($request)['name'];
    $request->cookies->set($name, 'a-session');
    if ($withToken) {
      $token = $this->container->get('csrf_token')
        ->get(CsrfRequestHeaderAccessCheck::TOKEN_KEY);
      $request->headers->set('X-CSRF-Token', $token);
    }
    return $request;
  }

  /**
   * The answer to a request, through the whole stack so access runs.
   */
  private function handle(Request $request): int {
    return $this->container->get('http_kernel')->handle($request)->getStatusCode();
  }

  /**
   * A signed-in reader ends their session, whoever started it.
   */
  public function testASignedInReaderEndsTheSession(): void {
    $this->setCurrentUser($this->createUser());
    self::assertSame(204, $this->handle($this->request()));
    self::assertTrue($this->container->get('current_user')->isAnonymous(), 'the session is over');
  }

  /**
   * Without the header token there is no way in, which is the whole protection.
   */
  public function testTheHeaderTokenIsRequired(): void {
    $this->setCurrentUser($this->createUser());
    self::assertSame(403, $this->handle($this->request(FALSE)));
    self::assertFalse(
      $this->container->get('current_user')->isAnonymous(),
      'and the session it could not prove is left alone'
    );
  }

  /**
   * A token that is not this session's is no token at all.
   */
  public function testAnotherSessionsTokenIsRefused(): void {
    $this->setCurrentUser($this->createUser());
    $request = $this->request(FALSE);
    $request->headers->set('X-CSRF-Token', 'not-a-token');
    self::assertSame(403, $this->handle($request));
  }

  /**
   * There is nothing for an anonymous request to end.
   */
  public function testAnonymousHasNoSessionToEnd(): void {
    self::assertSame(403, $this->handle($this->request()));
  }

}
