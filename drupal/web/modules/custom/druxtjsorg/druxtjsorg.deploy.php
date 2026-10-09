<?php

/**
 * @file
 * Deploy hooks: content changes a release makes once, after its config.
 */

declare(strict_types=1);

use Drupal\druxtjsorg\CalloutText;
use Drupal\druxtjsorg\NextSteps;
use Drupal\node\NodeInterface;

/**
 * Takes the blockquote marker out of every callout.
 *
 * The callouts came from markdown pages, where a callout was a blockquote.
 * The paragraph is the callout now, so the marker drew a quote inside the
 * callout's box. Each page whose callouts change gets a new revision, with
 * each changed paragraph at a new revision. Runs again without effect: a
 * callout that is not a blockquote throughout is left alone.
 */
function druxtjsorg_deploy_callout_quotes(array &$sandbox): string {
  $storage = \Drupal::entityTypeManager()->getStorage('node');
  $nids = $storage->getQuery()->accessCheck(FALSE)->condition('type', 'doc_page')->execute();
  $callouts = 0;
  $pages = 0;
  foreach ($storage->loadMultiple($nids) as $node) {
    assert($node instanceof NodeInterface);
    $changed = FALSE;
    // Each paragraph is changed on the item that holds it, so the node's new
    // revision references the paragraph's new revision when it is saved.
    foreach ($node->get('field_content') as $item) {
      $paragraph = $item->entity;
      if (!$paragraph || $paragraph->bundle() !== 'docs_callout' || $paragraph->get('field_callout')->isEmpty()) {
        continue;
      }
      $value = $paragraph->get('field_callout')->value;
      $text = CalloutText::unquote($value);
      if ($text === $value) {
        continue;
      }
      $paragraph->set('field_callout', ['value' => $text, 'format' => $paragraph->get('field_callout')->format]);
      $paragraph->setNewRevision(TRUE);
      $paragraph->save();
      // The item keeps naming the revision it loaded; point it at the new one.
      $item->target_revision_id = $paragraph->getRevisionId();
      $changed = TRUE;
      $callouts++;
    }
    if ($changed) {
      $node->setNewRevision(TRUE);
      $node->setRevisionLogMessage('The callouts lost the blockquote marker their markdown kept.');
      $node->setRevisionCreationTime(\Drupal::time()->getRequestTime());
      $node->save();
      $pages++;
    }
  }
  return "Took the blockquote marker out of $callouts callouts on $pages pages.";
}

/**
 * Moves the hand-written "Where to go next" lists into the field, and drops the landings' lists.
 *
 * Each page's section becomes its `field_next` links: a path that is a page
 * on this site becomes a link to that node, so it follows a rename or a move,
 * and any other path, a generated API page say, stays a path with its text.
 * A landing's list goes, since the docs_section view renders it now. Runs
 * again without effect: a page without the section is left alone.
 */
function druxtjsorg_deploy_next_steps(array &$sandbox): string {
  $storage = \Drupal::entityTypeManager()->getStorage('node');
  $alias = \Drupal::service('path_alias.manager');
  $nids = $storage->getQuery()->accessCheck(FALSE)->condition('type', 'doc_page')->execute();
  $pages = 0;
  $landings = 0;
  foreach ($storage->loadMultiple($nids) as $node) {
    assert($node instanceof NodeInterface);
    $landing = (bool) $node->get('field_is_landing')->value;
    $changed = FALSE;
    // Each paragraph is changed on the item that holds it, so the node's new
    // revision references the paragraph's new revision when it is saved.
    foreach ($node->get('field_content') as $item) {
      $paragraph = $item->entity;
      if (!$paragraph || $paragraph->bundle() !== 'docs_text' || $paragraph->get('field_text')->isEmpty()) {
        continue;
      }
      $value = $paragraph->get('field_text')->value;
      $result = $landing ? NextSteps::extractLanding($value) : NextSteps::extract($value);
      if (!$result['links']) {
        continue;
      }
      if (!$landing) {
        $links = [];
        foreach ($result['links'] as $link) {
          $system = $alias->getPathByAlias($link['path']);
          $nid = preg_match('#^/node/(\d+)$#', $system, $m) ? (int) $m[1] : NULL;
          $links[] = ['uri' => NextSteps::uri($link['path'], $nid), 'title' => $link['title']];
        }
        $node->set('field_next', $links);
      }
      $paragraph->set('field_text', ['value' => $result['text'], 'format' => $paragraph->get('field_text')->format]);
      $paragraph->setNewRevision(TRUE);
      $paragraph->save();
      // The item keeps naming the revision it loaded; point it at the new one.
      $item->target_revision_id = $paragraph->getRevisionId();
      $changed = TRUE;
    }
    if ($changed) {
      $node->setNewRevision(TRUE);
      $node->setRevisionLogMessage($landing ? 'The list of this section\'s pages comes from the docs_section view now.' : 'The "Where to go next" list moved to the field.');
      $node->setRevisionCreationTime(\Drupal::time()->getRequestTime());
      $node->save();
      $landing ? $landings++ : $pages++;
    }
  }
  return "Moved the next-step lists of $pages pages into the field, and dropped the lists of $landings landings.";
}
