<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Negotiator;

use Drupal\Core\Session\AccountInterface;
use Drupal\workspaces\Negotiator\WorkspaceIdNegotiatorInterface;
use Drupal\workspaces\Negotiator\WorkspaceNegotiatorInterface;
use Drupal\workspaces\WorkspaceInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * The workspace a signed-in editor chose, kept in a cookie both sides share.
 *
 * The frontend's editor bar writes the cookie, and Drupal's screens are served
 * through the frontend's origin, so an editor who chose a workspace there edits
 * in it here. Switching in Drupal's own toolbar writes the same cookie back, so
 * the two never disagree. A request header still outranks it.
 */
final class CookieWorkspaceNegotiator implements WorkspaceNegotiatorInterface, WorkspaceIdNegotiatorInterface, EventSubscriberInterface {

  /**
   * The cookie, named as the frontend names it.
   */
  public const COOKIE = 'druxt-workspace';

  /**
   * How long a choice is kept, in seconds, as the frontend keeps it.
   */
  private const MAX_AGE = 2592000;

  /**
   * The choice to write on the response: an id, '' to clear, NULL for none.
   */
  private ?string $pending = NULL;

  public function __construct(
    private readonly AccountInterface $currentUser,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [KernelEvents::RESPONSE => ['onResponse']];
  }

  /**
   * {@inheritdoc}
   */
  public function applies(Request $request): bool {
    return $this->currentUser->isAuthenticated() && !$request->headers->has(HeaderWorkspaceNegotiator::HEADER);
  }

  /**
   * {@inheritdoc}
   */
  public function getActiveWorkspaceId(Request $request): ?string {
    $id = (string) $request->cookies->get(self::COOKIE, '');
    return preg_match('/^[a-z0-9_]{1,128}$/', $id) ? $id : NULL;
  }

  /**
   * {@inheritdoc}
   */
  public function setActiveWorkspace(WorkspaceInterface $workspace): void {
    $this->pending = (string) $workspace->id();
  }

  /**
   * {@inheritdoc}
   */
  public function unsetActiveWorkspace(): void {
    $this->pending = '';
  }

  /**
   * Writes a choice made in Drupal back to the cookie the frontend reads.
   */
  public function onResponse(ResponseEvent $event): void {
    if ($this->pending === NULL || !$event->isMainRequest()) {
      return;
    }
    $request = $event->getRequest();
    // Readable by the frontend's script, which shows and changes it.
    $cookie = Cookie::create(self::COOKIE, $this->pending, $this->pending === '' ? 1 : time() + self::MAX_AGE, '/', NULL, $request->isSecure(), FALSE, FALSE, Cookie::SAMESITE_LAX);
    $event->getResponse()->headers->setCookie($cookie);
    $this->pending = NULL;
  }

}
