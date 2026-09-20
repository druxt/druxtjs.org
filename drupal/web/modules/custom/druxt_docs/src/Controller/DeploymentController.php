<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Reports the deployment this site has finished applying.
 *
 * The frontend builds against Drupal, reading display configuration as it
 * goes, so a build that starts before a rollout has run its database
 * updates and imported its configuration bakes in the previous release's
 * shape. Waiting for content to exist does not detect that: on an
 * established site the content is already there throughout.
 *
 * So the rollout records its own revision here once its updates have
 * succeeded, and the frontend waits until the revision it reads back is
 * the one it was itself built from.
 */
final class DeploymentController extends ControllerBase {

  /**
   * The state key the rollout writes once its updates have succeeded.
   */
  public const STATE_KEY = 'druxt_docs.deployed_revision';

  /**
   * The deployed revision, or null before a rollout has recorded one.
   *
   * Answers 200 either way. "No rollout has recorded a revision" is a
   * state the caller has to handle, not a failure of this endpoint, and a
   * non-200 would be indistinguishable from the endpoint being absent.
   *
   * @return \Symfony\Component\HttpFoundation\JsonResponse
   *   The deployed revision.
   */
  public function deployment(): JsonResponse {
    $revision = $this->state()->get(self::STATE_KEY);

    $response = new JsonResponse([
      'revision' => is_string($revision) && $revision !== '' ? $revision : NULL,
    ]);

    // A cached answer here would report the previous rollout's revision for
    // the length of the cache, which is the failure this endpoint exists to
    // prevent.
    $response->setPrivate();
    $response->setMaxAge(0);
    $response->headers->addCacheControlDirective('no-store');

    return $response;
  }

}
