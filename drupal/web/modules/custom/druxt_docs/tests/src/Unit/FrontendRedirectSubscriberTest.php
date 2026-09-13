<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\Core\Routing\TrustedRedirectResponse;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Site\Settings;
use Drupal\druxt_docs\EventSubscriber\FrontendRedirectSubscriber;
use Drupal\node\NodeInterface;
use Drupal\path_alias\AliasManagerInterface;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\HttpKernelInterface;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Where anonymous visitors to the backend end up.
 */
#[CoversClass(FrontendRedirectSubscriber::class)]
#[Group('druxt_docs')]
final class FrontendRedirectSubscriberTest extends UnitTestCase {

  /**
   * An anonymous visit to a page goes to the same page on the frontend.
   */
  public function testAPageGoesToTheSamePageOnTheFrontend(): void {
    $response = $this->request('redirectPage', $this->pageRequest());
    self::assertInstanceOf(TrustedRedirectResponse::class, $response);
    self::assertSame('https://druxtjs.org/guide/theming', $response->getTargetUrl());
  }

  /**
   * The site root goes to the frontend's home page.
   */
  public function testTheRootGoesToTheFrontendHome(): void {
    self::assertSame('https://druxtjs.org/', $this->request('redirectRoot', Request::create('/'))?->getTargetUrl());
  }

  /**
   * The root is handled before routing, which would refuse it first.
   */
  public function testTheRootIsHandledBeforeRouting(): void {
    $listeners = FrontendRedirectSubscriber::getSubscribedEvents()[KernelEvents::REQUEST];
    self::assertSame('redirectRoot', $listeners[0][0]);
    self::assertGreaterThan(32, $listeners[0][1]);
  }

  /**
   * Someone logged in stays on the backend.
   */
  public function testSomeoneLoggedInStays(): void {
    self::assertNull($this->request('redirectPage', $this->pageRequest(), anonymous: FALSE));
    self::assertNull($this->request('redirectRoot', Request::create('/'), anonymous: FALSE));
  }

  /**
   * Without a frontend to send them to, nobody is redirected.
   */
  public function testNothingRedirectsWithoutTheSetting(): void {
    self::assertNull($this->request('redirectPage', $this->pageRequest(), frontend: ''));
    self::assertNull($this->request('redirectRoot', Request::create('/'), frontend: ''));
  }

  /**
   * A request for another format is an API call, not a page view.
   */
  public function testAnotherFormatIsLeftAlone(): void {
    $request = $this->pageRequest();
    $request->setRequestFormat('json');
    self::assertNull($this->request('redirectPage', $request));
  }

  /**
   * The login form and other backend pages are left alone.
   */
  public function testOtherPagesAreLeftAlone(): void {
    $request = Request::create('/user/login');
    $request->attributes->set('_route', 'user.login');
    self::assertNull($this->request('redirectPage', $request));
    self::assertNull($this->request('redirectRoot', $request));
  }

  /**
   * A refused page sends an anonymous visitor to log in, and back after.
   */
  public function testARefusedPageGoesToTheLoginFormAndBack(): void {
    $response = $this->exception(Request::create('/admin/content?type=doc_page'), new AccessDeniedHttpException());
    self::assertSame('/user/login?destination=%2Fadmin%2Fcontent%3Ftype%3Ddoc_page', $response?->getTargetUrl());
  }

  /**
   * Only refusals redirect: a missing page stays a missing page.
   */
  public function testOtherErrorsAreLeftAlone(): void {
    self::assertNull($this->exception(Request::create('/nowhere'), new NotFoundHttpException()));
  }

  /**
   * Someone logged in who is refused sees the refusal, not a login form.
   */
  public function testSomeoneLoggedInIsNotSentToLogIn(): void {
    self::assertNull($this->exception(Request::create('/admin/config'), new AccessDeniedHttpException(), anonymous: FALSE));
  }

  /**
   * A refused API call keeps its error response.
   */
  public function testARefusedApiCallKeepsItsError(): void {
    $request = Request::create('/jsonapi/node/doc_page');
    $request->setRequestFormat('api_json');
    self::assertNull($this->exception($request, new AccessDeniedHttpException()));
  }

  /**
   * Runs one request listener and returns the response it set.
   */
  private function request(string $listener, Request $request, bool $anonymous = TRUE, string $frontend = 'https://druxtjs.org/'): ?Response {
    $event = new RequestEvent($this->createMock(HttpKernelInterface::class), $request, HttpKernelInterface::MAIN_REQUEST);
    $this->subscriber($anonymous, $frontend)->{$listener}($event);
    return $event->getResponse();
  }

  /**
   * Runs the exception listener and returns the response it set.
   */
  private function exception(Request $request, \Throwable $throwable, bool $anonymous = TRUE): ?Response {
    $event = new ExceptionEvent($this->createMock(HttpKernelInterface::class), $request, HttpKernelInterface::MAIN_REQUEST, $throwable);
    $this->subscriber($anonymous, 'https://druxtjs.org')->redirectToLogin($event);
    return $event->getResponse();
  }

  /**
   * The subscriber, for a visitor who is or is not logged in.
   */
  private function subscriber(bool $anonymous, string $frontend): FrontendRedirectSubscriber {
    new Settings(['druxt_docs_frontend_url' => $frontend]);
    $user = $this->createMock(AccountInterface::class);
    $user->method('isAnonymous')->willReturn($anonymous);
    $aliases = $this->createMock(AliasManagerInterface::class);
    $aliases->method('getAliasByPath')->willReturnMap([['/node/12', NULL, '/guide/theming']]);
    return new FrontendRedirectSubscriber($user, $aliases);
  }

  /**
   * A request that routed to a documentation page.
   */
  private function pageRequest(): Request {
    $node = $this->createMock(NodeInterface::class);
    $node->method('id')->willReturn(12);
    $request = Request::create('/guide/theming');
    $request->attributes->set('_route', 'entity.node.canonical');
    $request->attributes->set('node', $node);
    return $request;
  }

}
