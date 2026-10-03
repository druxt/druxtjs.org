<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\druxtjsorg\Hook\UserClaimsHooks;
use Drupal\field\Entity\FieldConfig;
use Drupal\field\Entity\FieldStorageConfig;
use Drupal\file\Entity\File;
use Drupal\KernelTests\KernelTestBase;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\user\Entity\Role;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The account's picture and roles, in the OpenID Connect userinfo.
 */
#[CoversClass(UserClaimsHooks::class)]
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class UserClaimsTest extends KernelTestBase {

  use UserCreationTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'field',
    'file',
    'image',
    'serialization',
    'jsonapi',
    'jsonapi_hypermedia',
    'druxtjsorg',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('file');
    $this->installSchema('file', ['file_usage']);
    $this->installConfig(['system', 'user', 'image']);
    FieldStorageConfig::create(['field_name' => 'user_picture', 'entity_type' => 'user', 'type' => 'image'])->save();
    FieldConfig::create(['field_name' => 'user_picture', 'entity_type' => 'user', 'bundle' => 'user'])->save();
    Role::create(['id' => 'editor', 'label' => 'Editor'])->save();
    $this->createUser();
  }

  /**
   * Claims for an account, as the hook leaves them.
   */
  private function claims($account): array {
    $claims = ['sub' => $account->id()];
    $context = ['account' => $account, 'claims' => []];
    $this->container->get(UserClaimsHooks::class)->claimsAlter($claims, $context);
    return $claims;
  }

  /**
   * Roles, without the one every account has; no picture without one.
   */
  public function testRolesAndNoPicture(): void {
    $account = $this->createUser();
    $account->addRole('editor');
    $account->save();
    $claims = $this->claims($account);
    self::assertSame(['editor'], $claims['roles']);
    self::assertNull($claims['picture']);
  }

  /**
   * The picture is served at the thumbnail style.
   */
  public function testThePictureAtTheThumbnailStyle(): void {
    file_put_contents('public://avatar.png', base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='));
    $file = File::create(['uri' => 'public://avatar.png']);
    $file->save();
    $account = $this->createUser();
    $account->set('user_picture', $file)->save();
    $claims = $this->claims($account);
    self::assertSame([], $claims['roles']);
    self::assertStringContainsString('/styles/thumbnail/public/avatar.png', (string) $claims['picture']);
  }

}
