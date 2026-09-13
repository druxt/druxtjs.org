<?php

declare(strict_types=1);

namespace Drupal\druxt_docs;

/**
 * The documentation sections.
 *
 * Read by the section migration. Terms are content, not configuration, so
 * a provisioned site has none and seeding creates them.
 *
 * Written out rather than derived from each section's landing page. Three
 * of the four landing titles happen to equal their term today and the
 * modules one does not: its page is titled "Druxt modules" and its term is
 * "Modules". Deriving would rename that term now, and would rename any
 * other the day someone retitles a landing page, which is a documentation
 * edit nobody would expect to migrate data. A section this map does not
 * name fails the run instead.
 */
final class Sections {

  /**
   * The vocabulary the sections live in.
   */
  public const VOCABULARY = 'documentation_section';

  /**
   * Machine name to name and sidebar weight.
   */
  public const ALL = [
    'tutorials' => ['name' => 'Tutorials', 'weight' => -10],
    'how-to' => ['name' => 'How-to guides', 'weight' => -9],
    'explanation' => ['name' => 'Concepts', 'weight' => -8],
    'modules' => ['name' => 'Modules', 'weight' => -7],
  ];

}
