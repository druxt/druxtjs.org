<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\Component\Serialization\Yaml;

/**
 * The site's pathauto settings and docs_issue pattern, from config/sync.
 *
 * A test using it enables token and pathauto, so a test of an issue's
 * alias fails when the exported rules change.
 */
trait IssuePatternTrait {

  /**
   * Installs pathauto's settings and the issue pattern as the site has them.
   */
  protected function installIssuePattern(): void {
    $this->installConfig(['system', 'pathauto']);
    $sync = fn (string $name): array => Yaml::decode((string) file_get_contents(DRUPAL_ROOT . '/../config/sync/' . $name . '.yml'));
    $settings = $sync('pathauto.settings');
    unset($settings['_core']);
    $this->config('pathauto.settings')->setData($settings)->save();
    $this->container->get('entity_type.manager')->getStorage('pathauto_pattern')
      ->createFromStorageRecord($sync('pathauto.pattern.docs_issue'))->save();
  }

}
