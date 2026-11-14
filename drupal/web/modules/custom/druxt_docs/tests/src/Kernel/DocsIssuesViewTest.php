<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\Component\Serialization\Yaml;
use Drupal\KernelTests\KernelTestBase;
use Drupal\views\Views;
use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\Attributes\Group;

/**
 * The docs_issues view, as the site exports it, filtering real issues.
 *
 * The config comes from config/sync, so the test fails when the exported
 * view or fields change in a way the troubleshooting page relies on.
 */
#[CoversNothing]
#[Group('druxt_docs')]
final class DocsIssuesViewTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'filter',
    'text',
    'file',
    'link',
    'views',
    'node',
    'entity_reference_revisions',
    'paragraphs',
    'options',
    'layout_discovery',
    'layout_paragraphs',
    'path',
    'path_alias',
    'druxt_docs',
  ];

  /**
   * The exported config the view needs, in dependency order.
   */
  private const CONFIG = [
    'node.type.docs_issue',
    'field.storage.node.field_description',
    'field.storage.node.field_issue_area',
    'field.storage.node.field_issue_search_text',
    'field.storage.node.field_weight',
    'field.field.node.docs_issue.field_description',
    'field.field.node.docs_issue.field_issue_area',
    'field.field.node.docs_issue.field_issue_search_text',
    'field.field.node.docs_issue.field_weight',
    'views.view.docs_issues',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('node');
    $this->installEntitySchema('path_alias');
    $this->installSchema('node', ['node_access']);
    $this->installConfig(['filter', 'node']);
    $config_manager = $this->container->get('config.manager');
    foreach (self::CONFIG as $name) {
      $record = Yaml::decode((string) file_get_contents(DRUPAL_ROOT . '/../config/sync/' . $name . '.yml'));
      $entity_type = $config_manager->getEntityTypeIdByName($name);
      $this->container->get('entity_type.manager')->getStorage($entity_type)->createFromStorageRecord($record)->save();
    }
    $this->container->get('current_user')->setAccount($this->createUserWithAccessContent());

    $this->issue('Blocked by CORS policy', 'backend', 'The browser refuses the API response.', 1);
    $this->issue('This dependency was not found: druxt', 'install', 'The build cannot resolve the module.', 0);
    $this->issue('A page shows old content', 'stale', 'Content changed in Drupal but not on the site.', 0);
    $this->issue('An unpublished issue about CORS', 'backend', 'Not ready.', 0, FALSE);
  }

  /**
   * With no filters, every published issue, by weight then title.
   */
  public function testEveryPublishedIssueByWeightThenTitle(): void {
    self::assertSame([
      'A page shows old content',
      'This dependency was not found: druxt',
      'Blocked by CORS policy',
    ], $this->titles([]));
  }

  /**
   * The area filter keeps one area's issues.
   */
  public function testTheAreaFilter(): void {
    self::assertSame(['Blocked by CORS policy'], $this->titles(['area' => 'backend']));
  }

  /**
   * A search keeps issues holding every word, in any order and case.
   */
  public function testASearchMatchesEveryWordInAnyOrder(): void {
    self::assertSame(['Blocked by CORS policy'], $this->titles(['q' => 'policy cors BLOCKED']));
    // The summary is searched as well as the title.
    self::assertSame(['This dependency was not found: druxt'], $this->titles(['q' => 'cannot resolve']));
    // One word missing from an issue leaves it out.
    self::assertSame([], $this->titles(['q' => 'cors dependency']));
  }

  /**
   * The titles the view returns for exposed input.
   *
   * @param array<string, string> $input
   *   The exposed filters, by identifier.
   *
   * @return list<string>
   *   The titles, in the view's order.
   */
  private function titles(array $input): array {
    $view = Views::getView('docs_issues');
    $view->setDisplay('default');
    $view->setExposedInput($input);
    $view->execute();
    return array_values(array_map(fn ($row): string => (string) $row->_entity->label(), $view->result));
  }

  /**
   * A saved issue.
   */
  private function issue(string $title, string $area, string $summary, int $weight, bool $published = TRUE): void {
    $this->container->get('entity_type.manager')->getStorage('node')->create([
      'type' => 'docs_issue',
      'title' => $title,
      'field_issue_area' => $area,
      'field_description' => $summary,
      'field_weight' => $weight,
      'status' => $published,
    ])->save();
  }

  /**
   * A user who may access content, as the view's access requires.
   */
  private function createUserWithAccessContent(): \Drupal\user\UserInterface {
    $role = $this->container->get('entity_type.manager')->getStorage('user_role')->create(['id' => 'reader', 'label' => 'Reader']);
    $role->grantPermission('access content')->save();
    $users = $this->container->get('entity_type.manager')->getStorage('user');
    // User 1 is the superuser, so the reader is created second.
    $users->create(['name' => 'admin'])->save();
    $user = $users->create(['name' => 'reader', 'roles' => ['reader']]);
    $user->save();
    return $user;
  }

}
