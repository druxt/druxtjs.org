<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Negotiator;

use Drupal\Core\Session\AccountInterface;
use Drupal\workspaces\Negotiator\WorkspaceIdNegotiatorInterface;
use Drupal\workspaces\Negotiator\WorkspaceNegotiatorInterface;
use Drupal\workspaces\WorkspaceInterface;
use Symfony\Component\HttpFoundation\Request;

/**
 * Selects the workspace an authenticated request names in a header.
 *
 * A bearer-token client has no session to hold an active workspace, and
 * JSON:API refuses core's query parameter, so the header is how a token client
 * reads and writes a workspace. The workspace manager then loads the id and
 * checks view access, and falls through to the next negotiator when either
 * fails, so an unknown or forbidden id answers from live for a token client.
 */
final class HeaderWorkspaceNegotiator implements WorkspaceNegotiatorInterface, WorkspaceIdNegotiatorInterface {

  /**
   * The request header that names the workspace.
   */
  public const HEADER = 'X-Druxt-Workspace';

  public function __construct(
    private readonly AccountInterface $currentUser,
  ) {}

  /**
   * {@inheritdoc}
   */
  public function applies(Request $request): bool {
    return $this->currentUser->isAuthenticated() && $request->headers->has(self::HEADER);
  }

  /**
   * {@inheritdoc}
   */
  public function getActiveWorkspaceId(Request $request): ?string {
    $id = trim((string) $request->headers->get(self::HEADER));
    // Workspace ids are machine names; anything else is not looked up.
    return preg_match('/^[a-z0-9_]{1,128}$/', $id) ? $id : NULL;
  }

  /**
   * {@inheritdoc}
   */
  public function setActiveWorkspace(WorkspaceInterface $workspace): void {
    // The header lasts one request, and never switches the session.
  }

  /**
   * {@inheritdoc}
   */
  public function unsetActiveWorkspace(): void {
  }

}
