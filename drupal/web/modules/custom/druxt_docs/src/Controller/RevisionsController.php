<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Controller;

use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Lists a documentation page's revisions, for the frontend's version switcher.
 *
 * JSON:API can fetch a revision by id but cannot enumerate them, so the
 * switcher reads the list here and then requests each revision over JSON:API
 * with `resourceVersion=id:<vid>`.
 */
final class RevisionsController extends ControllerBase {

  /**
   * A doc_page's revisions, newest first.
   *
   * @param string $uuid
   *   The page's uuid, as the frontend knows it.
   */
  public function list(string $uuid): JsonResponse {
    $storage = $this->entityTypeManager()->getStorage('node');
    $nodes = $storage->loadByProperties(['uuid' => $uuid, 'type' => 'doc_page']);
    $node = $nodes ? reset($nodes) : NULL;
    if ($node === NULL) {
      throw new NotFoundHttpException();
    }

    // The permission on the route says this role reads revision lists; it does
    // not say which pages. A contributor may view only their own unpublished
    // work, and a revision's date, state and log message describe the page it
    // belongs to, so the page's own access decides.
    if (!$node->access('view')) {
      throw new AccessDeniedHttpException();
    }

    $vids = $storage->getQuery()
      ->allRevisions()
      ->condition('nid', $node->id())
      ->sort('vid', 'DESC')
      ->accessCheck(FALSE)
      ->execute();
    $latest = (int) $storage->getLatestRevisionId($node->id());

    $revisions = [];
    foreach (array_keys($vids) as $vid) {
      $revision = $storage->loadRevision($vid);
      $revisions[] = [
        'vid' => (int) $vid,
        'date' => date(DATE_ATOM, (int) $revision->getRevisionCreationTime()),
        'state' => $revision->hasField('moderation_state') ? $revision->get('moderation_state')->value : NULL,
        'published' => $revision->isPublished(),
        'default' => $revision->isDefaultRevision(),
        'latest' => (int) $vid === $latest,
        'log' => $revision->getRevisionLogMessage(),
        'author' => $this->authorOf($revision),
      ];
    }

    // The list follows the page: a new draft or a publish changes it.
    return (new JsonResponse(['data' => $revisions]))->setPrivate()->setMaxAge(0);
  }

  /**
   * Who made a revision: their name, and their picture when they have one.
   *
   * @return array{name: string, picture: string|null}|null
   *   The author, or NULL when the revision has none.
   */
  private function authorOf($revision): ?array {
    $user = $revision->getRevisionUser();
    if (!$user) {
      return NULL;
    }
    $picture = NULL;
    if ($user->hasField('user_picture') && ($file = $user->get('user_picture')->entity)) {
      $style = $this->entityTypeManager()->getStorage('image_style')->load('thumbnail');
      $picture = $style ? $style->buildUrl($file->getFileUri()) : NULL;
    }
    return ['name' => $user->getDisplayName(), 'picture' => $picture];
  }

}
