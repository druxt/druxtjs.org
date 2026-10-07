<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\Core\Routing\RouteObjectInterface;
use Drupal\consumers\Entity\Consumer;
use Drupal\jsonapi\Routing\Routes;
use Drupal\KernelTests\KernelTestBase;
use Drupal\simple_oauth\Authentication\TokenAuthUserInterface;
use Drupal\Tests\user\Traits\UserCreationTrait;
use PHPUnit\Framework\Attributes\Group;
use Drupal\user\Entity\Role;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Route;

/**
 * Resources a named consumer may read, beyond the ones everybody may.
 *
 * `druxt.settings` has one audience, and here that audience is anonymous. A
 * resource describing who may do what cannot go on it. This gives the list a
 * second axis, keyed on the consumer the OAuth token names.
 */
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class ConsumerScopedResourcesTest extends KernelTestBase {

  use UserCreationTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'serialization',
    'image',
    'file',
    'consumers',
    'path_alias',
    'decoupled_router',
    'druxt',
    'druxtjsorg',
  ];

  /**
   * The scoped resource, which must never be public.
   */
  private const SCOPED = 'block_content_type--block_content_type';

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('consumer');
    $this->installEntitySchema('path_alias');
    $this->installConfig(['system', 'user', 'druxt', 'druxtjsorg']);
    // Uid 1 bypasses every access check, so it is spent here.
    $this->createUser();
    // The shipped list is empty on purpose, so the mechanism is exercised
    // with a resource of the test's choosing rather than a shipped decision.
    $this->config('druxtjsorg.settings')
      ->set('consumer_resources', ['druxtjs_org' => [self::SCOPED]])
      ->save();
  }

  /**
   * The consumer the frontend is.
   */
  private function consumer(string $clientId = 'druxtjs_org'): Consumer {
    $consumer = Consumer::create([
      'client_id' => $clientId,
      'label' => $clientId,
    ]);
    $consumer->save();
    return $consumer;
  }

  /**
   * An account authenticated by a token naming that consumer.
   */
  private function tokenUser(Consumer $consumer, bool $druxt = FALSE): TokenAuthUserInterface {
    $account = $this->createUser();
    $token = $this->createMock(TokenAuthUserInterface::class);
    $token->method('getConsumer')->willReturn($consumer);
    $token->method('id')->willReturn($account->id());
    $token->method('isAuthenticated')->willReturn(TRUE);
    $token->method('hasPermission')->willReturnCallback(fn (string $permission): bool => $druxt && $permission === 'access druxt resources');
    return $token;
  }

  /**
   * Anonymous reads the public list, and nothing beyond it.
   */
  public function testAnonymousNeverSeesTheScopedResource(): void {
    $resources = druxt_resources();
    self::assertNotContains(self::SCOPED, $resources, 'the world is not told who may do what');
    self::assertContains('menu--menu', $resources, 'and still reads what it is meant to');
  }

  /**
   * A session with no token reads the public list, however it is signed in.
   */
  public function testASignedInSessionWithoutATokenSeesNothingExtra(): void {
    $this->setCurrentUser($this->createUser());
    self::assertNotContains(self::SCOPED, druxt_resources());
  }

  /**
   * A token naming the consumer reads the scoped resource as well.
   */
  public function testTheConsumerOnTheTokenReadsIt(): void {
    \Drupal::currentUser()->setAccount($this->tokenUser($this->consumer()));

    $resources = druxt_resources();
    self::assertContains(self::SCOPED, $resources);
    self::assertContains('menu--menu', $resources, 'without losing the public ones');
    self::assertSame(
      array_values(array_unique($resources)),
      $resources,
      'and without repeating one'
    );
  }

  /**
   * A token naming another consumer reads nothing extra.
   */
  public function testAnotherConsumerReadsNothingExtra(): void {
    \Drupal::currentUser()->setAccount($this->tokenUser($this->consumer('somebody_else')));
    self::assertNotContains(self::SCOPED, druxt_resources());
  }

  /**
   * Access to a scoped resource is never cached, whatever the answer.
   *
   * Druxt's answer varies by nothing that names the consumer, so a stored
   * one would carry one consumer's grant to another.
   */
  public function testAccessToAScopedResourceIsNeverCached(): void {
    $this->config('druxtjsorg.settings')
      ->set('consumer_resources', ['druxtjs_org' => [self::SCOPED, 'user_role--user_role']])
      ->save();
    $role = Role::load('authenticated');
    $account = $this->tokenUser($this->consumer());

    self::assertSame(0, druxtjsorg_entity_access($role, 'view', $account)->getCacheMaxAge());

    $this->config('druxtjsorg.settings')->set('consumer_resources', ['druxtjs_org' => [self::SCOPED]])->save();
    self::assertNotSame(0, druxtjsorg_entity_access($role, 'view', $account)->getCacheMaxAge(), 'an unscoped resource keeps its lifetime');
  }

  /**
   * Only the consumer a resource is scoped to is granted it.
   *
   * Druxt decides by the route, so a JSON:API read of a public resource,
   * which can include a scoped one, passes its check for anyone with the
   * Druxt permission. Anonymous and other consumers must not be granted the
   * scoped entity that way.
   */
  public function testOnlyTheScopedConsumerIsGrantedIt(): void {
    $this->config('druxtjsorg.settings')
      ->set('consumer_resources', ['druxtjs_org' => ['user_role--user_role']])
      ->save();
    $route = new Route('/jsonapi/menu/menu', [
      RouteObjectInterface::CONTROLLER_NAME => Routes::CONTROLLER_SERVICE_NAME . ':getCollection',
      'resource_type' => 'menu--menu',
    ], [], [], '', [], ['GET']);
    $request = Request::create('/jsonapi/menu/menu');
    $request->attributes->set(RouteObjectInterface::ROUTE_OBJECT, $route);
    $request->attributes->set(RouteObjectInterface::ROUTE_NAME, 'jsonapi.menu--menu.collection');
    $request->setSession($this->container->get('request_stack')->getCurrentRequest()->getSession());
    $this->container->get('request_stack')->push($request);
    $this->container->get('current_route_match')->resetRouteMatch();
    user_role_grant_permissions('anonymous', ['access druxt resources']);
    $role = Role::load('authenticated');

    self::assertTrue(druxt_access_check(\Drupal::currentUser()), 'the route passes Druxt for anonymous');
    self::assertFalse(druxtjsorg_entity_access($role, 'view', \Drupal::currentUser())->isAllowed(), 'anonymous');
    self::assertFalse(druxtjsorg_entity_access($role, 'view', $this->tokenUser($this->consumer('somebody_else'), TRUE))->isAllowed(), 'another consumer');
    self::assertTrue(druxtjsorg_entity_access($role, 'view', $this->tokenUser($this->consumer(), TRUE))->isAllowed(), 'its consumer');
  }

}
