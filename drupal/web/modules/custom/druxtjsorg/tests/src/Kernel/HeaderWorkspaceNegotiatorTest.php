<?php

declare(strict_types=1);

namespace Drupal\Tests\druxtjsorg\Kernel;

use Drupal\Core\Session\AccountInterface;
use Drupal\Core\Session\AnonymousUserSession;
use Drupal\druxtjsorg\Negotiator\HeaderWorkspaceNegotiator;
use Drupal\KernelTests\KernelTestBase;
use Drupal\Tests\user\Traits\UserCreationTrait;
use Drupal\workspaces\Entity\Workspace;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The request header that selects a workspace for an authenticated request.
 */
#[CoversClass(HeaderWorkspaceNegotiator::class)]
#[Group('druxtjsorg')]
#[RunTestsInSeparateProcesses]
final class HeaderWorkspaceNegotiatorTest extends KernelTestBase {

  use UserCreationTrait;

  /**
   * {@inheritdoc}
   */
  protected static $modules = [
    'system',
    'user',
    'file',
    'serialization',
    'jsonapi',
    'jsonapi_hypermedia',
    'workspaces',
    'druxtjsorg',
  ];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->installEntitySchema('user');
    $this->installEntitySchema('workspace');
    $this->installSchema('workspaces', ['workspace_association', 'workspace_association_revision']);
    $this->installConfig(['system', 'user']);
    // Uid 1 bypasses every access check, so it is spent here.
    $this->createUser();
    Workspace::create(['id' => 'stage', 'label' => 'Stage'])->save();
    Workspace::create(['id' => 'other', 'label' => 'Other'])->save();
  }

  /**
   * An editor who may view the workspace is answered from it.
   */
  public function testAnEditorIsAnsweredFromTheNamedWorkspace(): void {
    self::assertSame('stage', $this->negotiate($this->editor(), 'stage'));
  }

  /**
   * The header outranks the workspace an editor's session holds.
   */
  public function testTheHeaderOutranksTheSession(): void {
    $this->container->get('session')->set('active_workspace_id', 'other');
    self::assertSame('stage', $this->negotiate($this->editor(), 'stage'));
  }

  /**
   * The header never changes the workspace an editor's session holds.
   */
  public function testTheHeaderLeavesTheSessionAlone(): void {
    $session = $this->container->get('session');
    $this->negotiate($this->editor(), 'stage');
    self::assertNull($session->get('active_workspace_id'));

    $session->set('active_workspace_id', 'other');
    $this->negotiate($this->editor(), 'stage');
    self::assertSame('other', $session->get('active_workspace_id'));
  }

  /**
   * An anonymous request is answered from live.
   */
  public function testAnAnonymousRequestIsAnsweredFromLive(): void {
    self::assertNull($this->negotiate(new AnonymousUserSession(), 'stage'));
  }

  /**
   * An account that may not view the workspace is answered from live.
   */
  public function testAnAccountWithoutAccessIsAnsweredFromLive(): void {
    self::assertNull($this->negotiate($this->createUser(['access content']), 'stage'));
  }

  /**
   * An id that names no workspace is answered from live.
   */
  public function testAnUnknownIdIsAnsweredFromLive(): void {
    self::assertNull($this->negotiate($this->editor(), 'nothing_here'));
  }

  /**
   * An id that could not be a machine name is not looked up.
   */
  public function testMalformedIdIsNotLookedUp(): void {
    $negotiator = new HeaderWorkspaceNegotiator($this->editor());
    foreach (['', 'Stage', 'st age', '../stage', str_repeat('a', 129)] as $id) {
      $request = \Drupal::request();
      $request->headers->set(HeaderWorkspaceNegotiator::HEADER, $id);
      self::assertNull($negotiator->getActiveWorkspaceId($request), $id);
    }
  }

  /**
   * Without the header the negotiator does not apply.
   */
  public function testWithoutTheHeaderTheNegotiatorDoesNotApply(): void {
    $request = \Drupal::request();
    $request->headers->remove(HeaderWorkspaceNegotiator::HEADER);
    self::assertFalse((new HeaderWorkspaceNegotiator($this->editor()))->applies($request));
  }

  /**
   * An account that may view any workspace.
   */
  private function editor(): AccountInterface {
    return $this->createUser(['view any workspace']);
  }

  /**
   * Negotiates the active workspace for a request that names one.
   *
   * @return string|null
   *   The active workspace's id, or NULL for live.
   */
  private function negotiate(AccountInterface $account, string $id): ?string {
    $this->setCurrentUser($account);
    \Drupal::request()->headers->set(HeaderWorkspaceNegotiator::HEADER, $id);
    // The manager keeps what it negotiated, so each case starts a fresh one.
    $this->container->set('workspaces.manager', NULL);
    return $this->container->get('workspaces.manager')->getActiveWorkspace()?->id();
  }

}
