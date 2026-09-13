<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\EventSubscriber;

use Drupal\Core\Routing\TrustedRedirectResponse;
use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Site\Settings;
use Drupal\node\NodeInterface;
use Drupal\path_alias\AliasManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Sends anonymous visitors from the backend to where they belong.
 *
 * The site root and every page go to the same path on the frontend named by
 * $settings['druxt_docs_frontend_url']. A page an anonymous visitor may not
 * see sends them to the login form, which returns them there afterwards.
 * The API and the login form itself are left alone.
 */
final class FrontendRedirectSubscriber implements EventSubscriberInterface {

  public function __construct(
    private readonly AccountInterface $currentUser,
    private readonly AliasManagerInterface $aliasManager,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [
      // The root before routing, at 32, because the front page it routes to
      // is one an anonymous visitor may not see. A page after routing, once
      // its node is known.
      KernelEvents::REQUEST => [['redirectRoot', 33], ['redirectPage', 30]],
      // Ahead of core's access denied page.
      KernelEvents::EXCEPTION => ['redirectToLogin', 80],
    ];
  }

  /**
   * Sends an anonymous visit to the root to the frontend's home page.
   */
  public function redirectRoot(RequestEvent $event): void {
    $request = $event->getRequest();
    $frontend = $this->frontend($request, $event->isMainRequest());
    if ($frontend !== NULL && $request->getPathInfo() === '/') {
      $event->setResponse(new TrustedRedirectResponse($frontend . '/', 302));
    }
  }

  /**
   * Sends an anonymous page view to the same page on the frontend.
   */
  public function redirectPage(RequestEvent $event): void {
    $request = $event->getRequest();
    $frontend = $this->frontend($request, $event->isMainRequest());
    $node = $request->attributes->get('node');
    if ($frontend !== NULL && $request->attributes->get('_route') === 'entity.node.canonical' && $node instanceof NodeInterface) {
      $event->setResponse(new TrustedRedirectResponse($frontend . $this->aliasManager->getAliasByPath('/node/' . $node->id()), 302));
    }
  }

  /**
   * Sends an anonymous visitor the backend refuses to the login form.
   */
  public function redirectToLogin(ExceptionEvent $event): void {
    $request = $event->getRequest();
    if (!$event->getThrowable() instanceof AccessDeniedHttpException || !$this->isAnonymousPageView($request, $event->isMainRequest())) {
      return;
    }
    $query = $request->getQueryString();
    $destination = $request->getPathInfo() . ($query !== NULL ? '?' . $query : '');
    $event->setResponse(new RedirectResponse($request->getBasePath() . '/user/login?' . http_build_query(['destination' => $destination])));
  }

  /**
   * The frontend to send this request to, or NULL to leave it alone.
   */
  private function frontend(Request $request, bool $main): ?string {
    $frontend = rtrim((string) Settings::get('druxt_docs_frontend_url', ''), '/');
    return $frontend !== '' && $this->isAnonymousPageView($request, $main) ? $frontend : NULL;
  }

  /**
   * Whether this is someone anonymous reading a page, not an API call.
   */
  private function isAnonymousPageView(Request $request, bool $main): bool {
    return $main && $request->isMethodSafe() && $request->getRequestFormat() === 'html' && $this->currentUser->isAnonymous();
  }

}
