<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\druxtjsorg\Negotiator\CookieWorkspaceNegotiator;
use Drupal\druxtjsorg\Negotiator\HeaderWorkspaceNegotiator;
use Drupal\KernelTests\KernelTestBase;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\workspaces\Entity\Workspace;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\HttpKernelInterface;

/**
 * The workspace an editor chose, in the cookie the frontend and Drupal share.
 */
#[CoversClass(CookieWorkspaceNegotiator::class)]
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class CookieWorkspaceNegotiatorTest extends KernelTestBase {

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
    'workspaces',
    'druxtjsorg',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('workspace');
    $this->installSchema('workspaces', ['workspace_association', 'workspace_association_revision']);
    $this->installConfig(['system', 'user']);
    // Uid 1 bypasses every access check, so it is spent here.
    $this->createUser();
    Workspace::create(['id' => 'stage', 'label' => 'Stage'])->save();
    Workspace::create(['id' => 'other', 'label' => 'Other'])->save();
  }

  /**
   * A signed-in editor reads in the workspace their cookie names.
   */
  public function testTheCookieChoosesTheWorkspace(): void {
    self::assertSame('stage', $this->negotiate($this->editor(), 'stage'));
  }

  /**
   * A reader's cookie is ignored.
   */
  public function testAReadersCookieIsIgnored(): void {
    self::assertNull($this->negotiate(new AnonymousUserSession(), 'stage'));
  }

  /**
   * The header outranks the cookie.
   */
  public function testTheHeaderOutranksTheCookie(): void {
    \Drupal::request()->headers->set(HeaderWorkspaceNegotiator::HEADER, 'other');
    self::assertSame('other', $this->negotiate($this->editor(), 'stage'));
  }

  /**
   * Switching in Drupal writes the cookie, and switching to live clears it.
   */
  public function testSwitchingInDrupalWritesTheCookie(): void {
    $this->setCurrentUser($this->editor());
    $manager = $this->container->get('workspaces.manager');

    $manager->setActiveWorkspace(Workspace::load('other'));
    $cookie = $this->writtenCookie();
    self::assertSame('other', $cookie?->getValue());
    self::assertFalse($cookie->isHttpOnly(), 'The frontend reads it.');

    $manager->switchToLive();
    self::assertTrue($this->writtenCookie()?->isCleared());
  }

  /**
   * An account that may view any workspace.
   */
  private function editor(): AccountInterface {
    return $this->createUser(['view any workspace']);
  }

  /**
   * Negotiates the workspace for a request carrying the cookie.
   */
  private function negotiate(AccountInterface $account, string $id): ?string {
    $this->setCurrentUser($account);
    \Drupal::request()->cookies->set(CookieWorkspaceNegotiator::COOKIE, $id);
    $this->container->set('workspaces.manager', NULL);
    return $this->container->get('workspaces.manager')->getActiveWorkspace()?->id();
  }

  /**
   * The cookie a response would carry, if any.
   */
  private function writtenCookie(): ?object {
    $response = new Response();
    $event = new ResponseEvent($this->container->get('http_kernel'), \Drupal::request(), HttpKernelInterface::MAIN_REQUEST, $response);
    $this->container->get('druxtjsorg.workspace_negotiator.cookie')->onResponse($event);
    foreach ($response->headers->getCookies() as $cookie) {
      if ($cookie->getName() === CookieWorkspaceNegotiator::COOKIE) {
        return $cookie;
      }
    }
    return NULL;
  }

}
