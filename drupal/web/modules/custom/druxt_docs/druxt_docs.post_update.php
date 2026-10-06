<?php

/**
 * @file
 * Post update functions for DruxtJS documentation.
 */

declare(strict_types=1);

/**
 * Drop the tables the removed documentation import kept its maps in.
 */
function druxt_docs_post_update_drop_import_maps(): string {
  $migrations = [
    'user', 'consumer', 'section', 'file', 'media',
    'paragraph_layout', 'paragraph_text', 'paragraph_code',
    'paragraph_diagram', 'paragraph_callout', 'paragraph_image',
    'page', 'alias', 'menu_section', 'menu_page', 'menu_footer',
  ];
  $schema = \Drupal::database()->schema();
  $dropped = 0;
  foreach ($migrations as $migration) {
    foreach (['migrate_map_docs_', 'migrate_message_docs_'] as $prefix) {
      if ($schema->dropTable($prefix . $migration)) {
        $dropped++;
      }
    }
  }
  \Drupal::state()->delete('druxt_docs.ir_directory');
  return sprintf('Dropped %d import tables.', $dropped);
}
