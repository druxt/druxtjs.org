<?php

/**
 * @file
 * Deploy hooks: content changes a release makes once, after its config.
 */

declare(strict_types=1);

use Drupal\druxtjsorg\CalloutText;
use Drupal\druxtjsorg\NextSteps;
use Drupal\node\Entity\Node;
use Drupal\node\NodeInterface;
use Drupal\paragraphs\Entity\Paragraph;
use Drupal\taxonomy\Entity\Term;

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
    foreach ($node->get('field_content') as $delta => $item) {
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
      $format = $paragraph->get('field_text')->format;
      $paragraph->set('field_text', ['value' => $landing ? $result['before'] : $result['text'], 'format' => $format]);
      $paragraph->setNewRevision(TRUE);
      $paragraph->save();
      // The item keeps naming the revision it loaded; point it at the new one.
      $item->target_revision_id = $paragraph->getRevisionId();
      $changed = TRUE;
      if ($landing) {
        // The list's block takes the list's place, and the prose that followed
        // the list follows the block, each inside the layout section the text
        // sits in. The tutorials read in order; the other sections group.
        $section = $node->get('field_section')->entity;
        $sequence = $section && $section->label() === 'Tutorials';
        $added = [NextSteps::sectionList($section ? (int) $section->id() : NULL, $sequence ? 'sequence' : 'default')];
        if ($result['after'] !== '') {
          $added[] = ['type' => 'docs_text', 'field_text' => ['value' => $result['after'], 'format' => $format]];
        }
        $insert = [];
        foreach ($added as $values) {
          $new = Paragraph::create($values);
          $new->setAllBehaviorSettings($paragraph->getAllBehaviorSettings());
          $new->save();
          $insert[] = ['target_id' => $new->id(), 'target_revision_id' => $new->getRevisionId()];
        }
        $items = $node->get('field_content')->getValue();
        array_splice($items, $delta + 1, 0, $insert);
        $node->set('field_content', $items);
        break;
      }
    }
    if ($changed) {
      $node->setNewRevision(TRUE);
      $node->setRevisionLogMessage($landing ? 'The list of this section\'s pages comes from the docs_section view now, where the list was.' : 'The "Where to go next" list moved to the field.');
      $node->setRevisionCreationTime(\Drupal::time()->getRequestTime());
      $node->save();
      $landing ? $landings++ : $pages++;
    }
  }
  return "Moved the next-step lists of $pages pages into the field, and dropped the lists of $landings landings.";
}

/**
 * Groups the how-to guides and the concepts under topic headings.
 *
 * The documentation_topic terms are created in their order, and each page
 * named here takes its topic. A page not named keeps none and lists first,
 * under no heading. Runs again without change.
 */
function druxtjsorg_deploy_topics(array &$sandbox): string {
  $terms = \Drupal::entityTypeManager()->getStorage('taxonomy_term');
  $alias = \Drupal::service('path_alias.manager');
  $created = 0;
  $assigned = 0;
  foreach (NextSteps::TOPICS as $weight => [$name, $paths]) {
    $existing = $terms->loadByProperties(['vid' => 'documentation_topic', 'name' => $name]);
    $term = $existing ? reset($existing) : NULL;
    if (!$term) {
      $term = Term::create(['vid' => 'documentation_topic', 'name' => $name, 'weight' => $weight]);
      $term->save();
      $created++;
    }
    foreach ($paths as $path) {
      $system = $alias->getPathByAlias($path);
      $node = preg_match('#^/node/(\d+)$#', $system, $m) ? Node::load($m[1]) : NULL;
      if (!$node || (int) $node->get('field_topic')->target_id === (int) $term->id()) {
        continue;
      }
      $node->set('field_topic', $term->id());
      $node->setNewRevision(TRUE);
      $node->setRevisionLogMessage('The page took its topic for the section landing.');
      $node->setRevisionCreationTime(\Drupal::time()->getRequestTime());
      $node->save();
      $assigned++;
    }
  }
  return "Created $created topics and gave $assigned pages theirs.";
}

/**
 * Installs the Workspace field on paragraphs, which Workspaces now tracks.
 *
 * The site keeps paragraphs tracked by Workspaces (WorkspaceEntityTypeHooks),
 * so core declares its Workspace revision field on them. A database copied
 * from before that has no column for it, and every revision query on a
 * paragraph, the live working copy's included, failed with "'workspace' not
 * found". A deploy hook rather than a post update: on a copy of production
 * the site module is installed by the configuration import, after the
 * updates have run, so a post update of its own is never pending there.
 */
function druxtjsorg_deploy_paragraph_workspace_field(): string {
  $manager = \Drupal::entityDefinitionUpdateManager();
  if ($manager->getFieldStorageDefinition('workspace', 'paragraph')) {
    return 'The paragraph Workspace field was already installed.';
  }
  $definitions = \Drupal::service('entity_field.manager')->getFieldStorageDefinitions('paragraph');
  if (!isset($definitions['workspace'])) {
    return 'Paragraphs are not tracked by Workspaces; nothing to install.';
  }
  $manager->installFieldStorageDefinition('workspace', 'paragraph', 'workspaces',
    $definitions['workspace']);
  return 'Installed the Workspace field on paragraphs.';
}
