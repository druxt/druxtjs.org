<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ends the Drupal session the request carries.
 *
 * Core's JSON logout wants a token Drupal issues only at login, so a frontend
 * that did not start the session cannot end it: a session left open by
 * somebody else, or by a sign-in abandoned before it finished, stays until its
 * cookie expires. This ends whichever session the request carries, which is
 * the one the reader is sitting in front of.
 *
 * The route is protected the way core protects its own write endpoints, with
 * the `X-CSRF-Token` header that `/session/token` issues for the current
 * session. Another origin can neither read that token nor send the cookie, so
 * the only caller that can reach this is a page on this site's own origin.
 */
final class SessionController extends ControllerBase {

  /**
   * Ends the session, and answers with nothing.
   */
  public function end(): Response {
    user_logout();
    return new Response(NULL, 204);
  }

}
