<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Kernel;

use Drupal\KernelTests\KernelTestBase;
use Drupal\node\Entity\NodeType;
use Drupal\paragraphs\Entity\ParagraphsType;
use Drupal\user\Entity\Role;
use Drupal\user\Entity\User;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Session\Session;
use Symfony\Component\HttpFoundation\Session\Storage\MockArraySessionStorage;

/**
 * A page's authors may create its paragraphs over JSON:API; nobody else may.
 *
 * @group druxt_docs
 */
final class ParagraphCreateAccessTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'file',
    'node',
    'path_alias',
    'entity_reference_revisions',
    'paragraphs',
    'druxt_docs',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('node');
    $this->installEntitySchema('paragraph');
    // The permission the hook keys on exists once the page type does.
    NodeType::create(['type' => 'doc_page', 'name' => 'Documentation page'])->save();
    // User 1 is not asked for permissions, so it is created and set aside.
    User::create(['name' => 'root'])->save();
    foreach (['docs_text', 'docs_layout_section', 'unrelated'] as $type) {
      ParagraphsType::create(['id' => $type, 'label' => $type])->save();
    }
    // JSON:API, not an entity form: the format paragraphs is neutral for.
    $request = Request::create('/jsonapi/paragraph/docs_text', 'POST');
    $request->setRequestFormat('api_json');
    $request->setSession(new Session(new MockArraySessionStorage()));
    $this->container->get('request_stack')->push($request);
  }

  /**
   * Creates a user holding the given permissions.
   */
  private function userWith(array $permissions): User {
    $role = Role::create(['id' => $this->randomMachineName(8), 'label' => 'test']);
    foreach ($permissions as $permission) {
      $role->grantPermission($permission);
    }
    $role->save();
    $user = User::create(['name' => $this->randomMachineName(), 'roles' => [$role->id()]]);
    $user->save();
    return $user;
  }

  /**
   * Whether an account may create a paragraph of the bundle, in this request.
   */
  private function mayCreate(User $account, string $bundle): bool {
    return $this->container->get('entity_type.manager')
      ->getAccessControlHandler('paragraph')
      ->createAccess($bundle, $account, [], TRUE)
      ->isAllowed();
  }

  /**
   * A page author may create the page's paragraph types.
   */
  public function testAuthorMayCreateDocsParagraphs(): void {
    $author = $this->userWith(['create doc_page content']);
    self::assertTrue($this->mayCreate($author, 'docs_text'));
    self::assertTrue($this->mayCreate($author, 'docs_layout_section'));
  }

  /**
   * The grant is scoped: not other bundles, not users without the permission.
   */
  public function testNobodyElseMayCreate(): void {
    $author = $this->userWith(['create doc_page content']);
    $reader = $this->userWith(['access content']);
    self::assertFalse($this->mayCreate($author, 'unrelated'));
    self::assertFalse($this->mayCreate($reader, 'docs_text'));
  }

}
