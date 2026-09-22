<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\EventSubscriber;

use Drupal\Core\Session\AccountInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Tells the frontend's script that a signed-in user may be looking.
 *
 * The session cookie is HttpOnly, so without this the script could only find
 * out by asking Drupal, and every anonymous reader would pay for the request.
 * It is a hint, not a credential: what an editor is offered is still decided
 * by Drupal on each request.
 */
final class EditorHintSubscriber implements EventSubscriberInterface {

  /**
   * The cookie's name.
   */
  public const COOKIE = 'druxt_editor';

  public function __construct(private readonly AccountInterface $currentUser) {}

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [KernelEvents::RESPONSE => ['onResponse']];
  }

  /**
   * Sets the hint for a signed-in user, and clears one left behind.
   */
  public function onResponse(ResponseEvent $event): void {
    if (!$event->isMainRequest()) {
      return;
    }
    $has_hint = $event->getRequest()->cookies->has(self::COOKIE);
    $signed_in = $this->currentUser->isAuthenticated();
    if ($signed_in && !$has_hint) {
      $event->getResponse()->headers->setCookie(Cookie::create(self::COOKIE, '1', 0, '/', NULL, NULL, FALSE, FALSE, Cookie::SAMESITE_LAX));
    }
    elseif (!$signed_in && $has_hint) {
      $event->getResponse()->headers->clearCookie(self::COOKIE, '/', NULL, FALSE, FALSE, Cookie::SAMESITE_LAX);
    }
  }

}
