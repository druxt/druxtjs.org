<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\EventSubscriber;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Session\AccountInterface;
use Drupal\druxtjsorg\Negotiator\CookieWorkspaceNegotiator;
use Drupal\druxtjsorg\Negotiator\HeaderWorkspaceNegotiator;
use Drupal\workspaces\WorkspaceInterface;
use Drupal\workspaces\WorkspaceManagerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\RequestEvent;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Activates the workspace a request names, once the request is authenticated.
 *
 * The request names it in the header, or the editor's cookie does.
 *
 * The negotiator alone is not enough: Simple OAuth's authentication provider
 * resolves the path, the alias lookup asks for the active workspace while the
 * request is still anonymous, and the manager keeps that answer, live, for
 * the rest of the request. This runs after authentication and before routing
 * loads any entity, and activates the workspace for this request only.
 *
 * A write whose header names a workspace it cannot have is refused, never sent
 * to live. A cookie naming one is a stale choice, kept for thirty days past a
 * workspace an editor deleted or lost: the request reads and writes live, and
 * the response's cookie follows the active workspace, so the choice clears.
 */
final class WorkspaceHeaderSubscriber implements EventSubscriberInterface {

  /**
   * The request attribute recording the workspace this subscriber activated.
   */
  public const ATTRIBUTE = '_druxtjsorg_workspace';

  public function __construct(
    private readonly AccountInterface $currentUser,
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly WorkspaceManagerInterface $workspaceManager,
    private readonly HeaderWorkspaceNegotiator $negotiator,
    private readonly ?CookieWorkspaceNegotiator $cookieNegotiator = NULL,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [
      // After AuthenticationSubscriber (300), before routing (32).
      KernelEvents::REQUEST => [
        ['activate', 299],
        // After the route's authentication providers are enforced (31).
        ['confirm', 30],
      ],
    ];
  }

  /**
   * Activates the named workspace, or refuses a write that cannot have it.
   */
  public function activate(RequestEvent $event): void {
    $request = $event->getRequest();
    if (!$event->isMainRequest()) {
      return;
    }
    // The header, or else the editor's cookie; the header always wins.
    $header = $this->negotiator->applies($request);
    if ($header) {
      $id = $this->negotiator->getActiveWorkspaceId($request);
    }
    elseif ($this->cookieNegotiator?->applies($request) && $request->cookies->has(CookieWorkspaceNegotiator::COOKIE)) {
      $id = $this->cookieNegotiator->getActiveWorkspaceId($request);
    }
    else {
      return;
    }

    $workspace = $this->workspace($id);
    if ($workspace !== NULL) {
      // Not persisted: this request only, and the session is left alone.
      $this->workspaceManager->setActiveWorkspace($workspace, FALSE);
      $request->attributes->set(self::ATTRIBUTE, $workspace->id());
      return;
    }

    // One answer for unknown and forbidden, so neither reveals the other. Only
    // the header is refused: a stale cookie would otherwise block every form
    // the editor submits in Drupal, the workspace switcher among them.
    if ($header && !$request->isMethodSafe()) {
      throw new AccessDeniedHttpException('The workspace this request names is not available.');
    }
  }

  /**
   * Refuses a workspace request whose account the route did not accept.
   */
  public function confirm(RequestEvent $event): void {
    if ($event->getRequest()->attributes->has(self::ATTRIBUTE) && !$this->currentUser->isAuthenticated()) {
      throw new AccessDeniedHttpException('The workspace this request names is not available.');
    }
  }

  /**
   * The workspace with this id, when the current account may view it.
   */
  private function workspace(?string $id): ?WorkspaceInterface {
    if ($id === NULL) {
      return NULL;
    }
    $workspace = $this->entityTypeManager->getStorage('workspace')->load($id);
    return $workspace instanceof WorkspaceInterface && $workspace->access('view', $this->currentUser) ? $workspace : NULL;
  }

}
