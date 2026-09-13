<?php

/**
 * @file
 * Builds the documentation content model.
 *
 * Run once with `drush php:script scripts/build-content-model.php`, then
 * `drush config:export`. The exported configuration under config/sync is the
 * source of truth from that point on; this script is how it was derived and
 * why, kept so the reasoning behind each field survives the export.
 *
 * Every field here answers to something the corpus actually contains. The
 * measurements are in the survey the migration change carries, and no field
 * exists without a signal behind it.
 */

declare(strict_types=1);

use Drupal\druxt_docs\Identity;
use Drupal\field\Entity\FieldConfig;
use Drupal\media\Entity\MediaType;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\filter\Entity\FilterFormat;
use Drupal\node\Entity\NodeType;
use Drupal\paragraphs\Entity\ParagraphsType;
use Drupal\taxonomy\Entity\Term;
use Drupal\taxonomy\Entity\Vocabulary;

/**
 * Creates an entity only when it is absent, so the script can be re-run.
 */
function ensure(string $entity_type, string $id, callable $create): void {
  $storage = \Drupal::entityTypeManager()->getStorage($entity_type);
  if ($storage->load($id) === NULL) {
    $create()->save();
    echo sprintf("  created %s %s\n", $entity_type, $id);
    return;
  }
  echo sprintf("  exists  %s %s\n", $entity_type, $id);
}

/**
 * Creates a field storage and its bundle instance when absent.
 */
function ensure_field(
  string $entity_type,
  string $bundle,
  string $name,
  string $type,
  string $label,
  array $storage_settings = [],
  array $field_settings = [],
  bool $required = FALSE,
  int $cardinality = 1,
): void {
  $storage_id = "$entity_type.$name";
  if (FieldStorageConfig::load($storage_id) === NULL) {
    FieldStorageConfig::create([
      'field_name' => $name,
      'entity_type' => $entity_type,
      'type' => $type,
      'cardinality' => $cardinality,
      'settings' => $storage_settings,
    ])->save();
  }

  $field_id = "$entity_type.$bundle.$name";
  if (FieldConfig::load($field_id) === NULL) {
    FieldConfig::create([
      'field_name' => $name,
      'entity_type' => $entity_type,
      'bundle' => $bundle,
      'label' => $label,
      'required' => $required,
      'settings' => $field_settings,
    ])->save();
    echo sprintf("  created field %s\n", $field_id);
    return;
  }
  echo sprintf("  exists  field %s\n", $field_id);
}

// ---------------------------------------------------------------------------
// Text format.
// ---------------------------------------------------------------------------
// Text paragraphs store markdown, which is what makes an exact round-trip
// against the source files possible. Drupal converts it, so an edit made in
// the CMS renders rather than sitting there as literal markdown.

echo "Text format\n";
ensure('filter_format', 'docs_markdown', fn() => FilterFormat::create([
  'format' => 'docs_markdown',
  'name' => 'Documentation markdown',
  'weight' => 0,
  'filters' => [
    'markdown_easy' => [
      'id' => 'markdown_easy',
      'provider' => 'markdown_easy',
      'status' => TRUE,
      'weight' => 0,
      // GitHub-flavoured, not standard CommonMark: the corpus has 24
      // tables, and standard CommonMark has no table syntax at all.
      'settings' => ['flavor' => 'github'],
    ],
    // Runs after the markdown filter, on the HTML it produced.
    'filter_html_image_secure' => [
      'id' => 'filter_html_image_secure',
      'provider' => 'filter',
      'status' => TRUE,
      'weight' => 10,
      'settings' => [],
    ],
  ],
]));

// ---------------------------------------------------------------------------
// Section vocabulary.
// ---------------------------------------------------------------------------
// Four sections, one per Diataxis quadrant the corpus is organised into. The
// directory a page sits in is the only signal for this, so it is a closed set
// rather than free tagging.

echo "\nSection vocabulary\n";
ensure('taxonomy_vocabulary', 'documentation_section', fn() => Vocabulary::create([
  'vid' => 'documentation_section',
  'name' => 'Documentation section',
  'description' => 'The Diataxis quadrant a documentation page belongs to.',
]));

$sections = [
  'tutorials' => ['Tutorials', -10],
  'how-to' => ['How-to guides', -9],
  'explanation' => ['Concepts', -8],
  'modules' => ['Modules', -7],
];
foreach ($sections as $machine => [$name, $weight]) {
  $uuid = Identity::section($machine);
  $existing = \Drupal::entityTypeManager()->getStorage('taxonomy_term')
    ->loadByProperties(['uuid' => $uuid]);
  if ($existing === []) {
    $term = Term::create([
      'uuid' => $uuid,
      'vid' => 'documentation_section',
      'name' => $name,
      'weight' => $weight,
      // The directory name, so the importer can map a source path to a term
      // without depending on the human-facing label.
      'description' => ['value' => $machine, 'format' => 'plain_text'],
    ]);
    $term->save();
    echo sprintf("  created term %s (%s) %s\n", $name, $machine, $uuid);
  }
  else {
    echo sprintf("  exists  term %s\n", $name);
  }
}

// ---------------------------------------------------------------------------
// Image media.
// ---------------------------------------------------------------------------
// The minimal install profile ships no media bundles, and the corpus needs
// exactly one. Alt text lives on the image field rather than on the
// paragraph, because it belongs to the image and the same image is reused
// across pages.

echo "\nImage media\n";
ensure('media_type', 'image', fn() => MediaType::create([
  'id' => 'image',
  'label' => 'Image',
  'description' => 'An illustration used in the documentation.',
  'source' => 'image',
  'source_configuration' => ['source_field' => 'field_media_image'],
  'field_map' => [],
]));
ensure_field(
  'media',
  'image',
  'field_media_image',
  'image',
  'Image',
  [],
  [
    // Alt text is substantive description in this corpus, not incidental,
    // so it is required and generously sized.
    'alt_field' => TRUE,
    'alt_field_required' => TRUE,
    'title_field' => FALSE,
    'file_directory' => 'documentation',
    'file_extensions' => 'png jpg jpeg gif svg webp',
  ],
  TRUE,
);

// ---------------------------------------------------------------------------
// Paragraph types.
// ---------------------------------------------------------------------------

echo "\nParagraph types\n";

// Prose. Holds markdown, including the tables and lists the corpus keeps
// inside prose, and the fences it indents inside list items: those cannot be
// lifted into sibling code paragraphs without destroying the list.
ensure('paragraphs_type', 'docs_text', fn() => ParagraphsType::create([
  'id' => 'docs_text',
  'label' => 'Text',
  'description' => 'Authored prose, stored as markdown.',
]));
ensure_field('paragraph', 'docs_text', 'field_text', 'text_long', 'Text', [], [], TRUE);

// Code. The language is a field rather than a fence token because the
// frontend highlights on it and validation asserts against it.
ensure('paragraphs_type', 'docs_code', fn() => ParagraphsType::create([
  'id' => 'docs_code',
  'label' => 'Code',
  'description' => 'A fenced code example, stored verbatim with its language.',
]));
ensure_field('paragraph', 'docs_code', 'field_code', 'string_long', 'Code', [], [], TRUE);
ensure_field(
  'paragraph',
  'docs_code',
  'field_language',
  'list_string',
  'Language',
  ['allowed_values' => [
    'js' => 'JavaScript',
    'sh' => 'Shell',
    'vue' => 'Vue',
    'json' => 'JSON',
    'yaml' => 'YAML',
    'nginx' => 'nginx',
    'text' => 'Plain text',
  ]],
  [],
  TRUE,
);

// Diagrams. Distinct from code because they render as diagrams, not as
// highlighted source. The group field records diagrams the source lays out
// together, replacing the one raw HTML wrapper in the corpus: presentation
// stays out of the content.
ensure('paragraphs_type', 'docs_diagram', fn() => ParagraphsType::create([
  'id' => 'docs_diagram',
  'label' => 'Diagram',
  'description' => 'A diagram, stored as its source.',
]));
ensure_field('paragraph', 'docs_diagram', 'field_diagram', 'string_long', 'Diagram source', [], [], TRUE);
ensure_field(
  'paragraph',
  'docs_diagram',
  'field_syntax',
  'list_string',
  'Syntax',
  ['allowed_values' => ['mermaid' => 'Mermaid']],
  [],
  TRUE,
);
ensure_field('paragraph', 'docs_diagram', 'field_group', 'string', 'Group', ['max_length' => 64]);

// Callouts. Every one of the corpus's callouts shares a single lead phrase,
// so this is a real convention rather than a pattern imposed on irregular
// content. Program output is a separate type because it is a sample: it is
// read as monospaced text and must not be spellchecked or translated as
// prose.
ensure('paragraphs_type', 'docs_callout', fn() => ParagraphsType::create([
  'id' => 'docs_callout',
  'label' => 'Callout',
  'description' => 'A prerequisite notice or other set-aside advisory.',
]));
ensure_field('paragraph', 'docs_callout', 'field_callout', 'text_long', 'Callout', [], [], TRUE);
ensure_field(
  'paragraph',
  'docs_callout',
  'field_callout_type',
  'list_string',
  'Callout type',
  ['allowed_values' => [
    'prerequisite' => 'Before you start',
    'output' => 'Program output',
  ]],
  [],
  TRUE,
);

// Images. A media reference rather than a file, so alt text, reuse across
// pages and the media library all come for free.
ensure('paragraphs_type', 'docs_image', fn() => ParagraphsType::create([
  'id' => 'docs_image',
  'label' => 'Image',
  'description' => 'An illustration, referencing a media item.',
]));
ensure_field(
  'paragraph',
  'docs_image',
  'field_media',
  'entity_reference',
  'Media',
  ['target_type' => 'media'],
  ['handler' => 'default:media', 'handler_settings' => ['target_bundles' => ['image' => 'image']]],
  TRUE,
);

// ---------------------------------------------------------------------------
// Documentation page.
// ---------------------------------------------------------------------------

echo "\nDocumentation page\n";
ensure('node_type', 'doc_page', fn() => NodeType::create([
  'type' => 'doc_page',
  'name' => 'Documentation page',
  'description' => 'A page of the druxtjs.org documentation.',
  'new_revision' => TRUE,
  'preview_mode' => DRUPAL_OPTIONAL,
  'display_submitted' => FALSE,
]));

// Carried on every page in the corpus, and used as the meta description and
// the section listing summary.
ensure_field('node', 'doc_page', 'field_description', 'string_long', 'Description', [], [], TRUE);

// Not universal: one page carries no weight, so this is optional and the
// sort falls back to a documented default.
ensure_field('node', 'doc_page', 'field_weight', 'integer', 'Weight');

ensure_field(
  'node',
  'doc_page',
  'field_section',
  'entity_reference',
  'Section',
  ['target_type' => 'taxonomy_term'],
  [
    'handler' => 'default:taxonomy_term',
    'handler_settings' => ['target_bundles' => ['documentation_section' => 'documentation_section']],
  ],
  TRUE,
);

// Marks the four section index pages, which are excluded from their own
// section's child listing.
ensure_field('node', 'doc_page', 'field_is_landing', 'boolean', 'Section landing page');

// The path of the markdown file this page came from. Kept for traceability:
// it is what lets validation compare a migrated page against its source, and
// what makes a re-import idempotent rather than duplicating.
ensure_field('node', 'doc_page', 'field_source_path', 'string', 'Source path', ['max_length' => 255], [], TRUE);

// The table of contents is not stored: druxt_docs computes field_toc from
// field_content whenever it is read.

ensure_field(
  'node',
  'doc_page',
  'field_content',
  'entity_reference_revisions',
  'Content',
  ['target_type' => 'paragraph'],
  [
    'handler' => 'default:paragraph',
    'handler_settings' => [
      'target_bundles' => [
        'docs_text' => 'docs_text',
        'docs_code' => 'docs_code',
        'docs_diagram' => 'docs_diagram',
        'docs_callout' => 'docs_callout',
        'docs_image' => 'docs_image',
      ],
      // Ordered by how often each appears in the corpus, so the editor's
      // first choice is the one they almost always want.
      'target_bundles_drag_drop' => [
        'docs_text' => ['enabled' => TRUE, 'weight' => 1],
        'docs_code' => ['enabled' => TRUE, 'weight' => 2],
        'docs_image' => ['enabled' => TRUE, 'weight' => 3],
        'docs_callout' => ['enabled' => TRUE, 'weight' => 4],
        'docs_diagram' => ['enabled' => TRUE, 'weight' => 5],
      ],
    ],
  ],
  TRUE,
  FieldStorageConfig::CARDINALITY_UNLIMITED,
);

// ---------------------------------------------------------------------------
// Anonymous read access.
// ---------------------------------------------------------------------------
// The docs site reads the backend unauthenticated at build time, so every
// read the frontend performs has to work for the anonymous role. Granting it
// here rather than by hand keeps the permission set reviewable in config
// alongside the model it applies to.

echo "\nAnonymous read access\n";
$anonymous = \Drupal::entityTypeManager()->getStorage('user_role')->load('anonymous');
$permissions = [
  'access content',
  'access druxt resources',
  'view media',
];
foreach ($permissions as $permission) {
  if ($anonymous->hasPermission($permission)) {
    echo sprintf("  has     %s\n", $permission);
    continue;
  }
  $anonymous->grantPermission($permission);
  echo sprintf("  granted %s\n", $permission);
}
$anonymous->save();

echo "\nDone. Export with: drush config:export\n";
