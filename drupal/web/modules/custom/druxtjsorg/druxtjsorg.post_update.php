<?php

/**
 * @file
 * Post update functions for the druxtjs.org site module.
 */

declare(strict_types=1);

/**
 * Installs the Workspace field on paragraphs, which Workspaces now tracks.
 *
 * The site keeps paragraphs tracked by Workspaces (WorkspaceEntityTypeHooks),
 * so core declares its Workspace revision field on them. A database copied
 * from before that has no column for it, and every revision query on a
 * paragraph, the live working copy's included, failed with "'workspace' not
 * found".
 */
function druxtjsorg_post_update_paragraph_workspace_field(): void {
  $manager = \Drupal::entityDefinitionUpdateManager();
  if ($manager->getFieldStorageDefinition('workspace', 'paragraph')) {
    return;
  }
  $definitions = \Drupal::service('entity_field.manager')->getFieldStorageDefinitions('paragraph');
  if (isset($definitions['workspace'])) {
    $manager->installFieldStorageDefinition('workspace', 'paragraph', 'workspaces', $definitions['workspace']);
  }
}
