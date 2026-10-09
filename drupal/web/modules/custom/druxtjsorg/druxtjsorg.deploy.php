<?php

/**
 * @file
 * Deploy hooks: content changes a release makes once, after its config.
 */

declare(strict_types=1);

use Drupal\druxtjsorg\CalloutText;
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
