<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\Identity;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

#[CoversClass(Identity::class)]
#[Group('druxt_docs')]
final class IdentityTest extends UnitTestCase {

  /**
   * The committed section terms carry these UUIDs.
   *
   * They were derived when the content model was built. If this fails, the
   * derivation changed and every committed identifier is orphaned.
   */
  public function testSectionMatchesCommittedTerms(): void {
    $this->assertSame('4f80265c-02fd-5652-8970-c0bf9eaf5e5b', Identity::section('explanation'));
  }

  /**
   * The result is a version 5 UUID.
   */
  public function testUuidIsVersionFive(): void {
    $uuid = Identity::uuid('anything');
    $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $uuid);
    $this->assertSame($uuid, Identity::uuid('anything'));
  }

  /**
   * Each kind of entity derives from its own name, so none can collide.
   */
  public function testKindsDoNotCollide(): void {
    $source = 'docs/nuxt/content/how-to/theming.md';
    $uuids = [
      Identity::page($source),
      Identity::paragraph($source, 0),
      Identity::paragraph($source, 1),
      Identity::alias($source),
      Identity::media('/images/theming.png'),
      Identity::file('/images/theming.png'),
      Identity::section('how-to'),
      Identity::user('stuart-clark'),
      Identity::consumer('druxtjs_org'),
    ];
    $this->assertCount(count($uuids), array_unique($uuids));
  }

  /**
   * An earlier version's paragraphs are its own, stable, and apart.
   *
   * A second import of the same history has to land on the same entities,
   * and no earlier version may take a UUID the current page already holds.
   */
  public function testRevisionParagraphsAreStableAndApart(): void {
    $source = 'docs/nuxt/content/how-to/proxy.md';
    $first = str_repeat('a', 40);
    $second = str_repeat('b', 40);
    $this->assertSame(Identity::revisionParagraph($source, $first, 0), Identity::revisionParagraph($source, $first, 0));
    $uuids = [
      Identity::revisionParagraph($source, $first, 0),
      Identity::revisionParagraph($source, $first, 1),
      Identity::revisionParagraph($source, $second, 0),
      Identity::revisionSectionParagraph($source, $first, 0),
      Identity::revisionSectionParagraph($source, $second, 0),
      Identity::paragraph($source, 0),
      Identity::sectionParagraph($source, 0),
    ];
    $this->assertCount(count($uuids), array_unique($uuids));
  }

  /**
   * An author's UUID is stable, and no other kind of entity can take it.
   *
   * A reseed has to find the same account, or every page would be
   * reassigned to a new one.
   */
  public function testUserIsStableAndDistinct(): void {
    $user = Identity::user('stuart-clark');
    $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $user);
    $this->assertSame($user, Identity::user('stuart-clark'));
    $this->assertNotSame($user, Identity::user('someone-else'));
    $this->assertNotContains($user, [
      Identity::page('stuart-clark'),
      Identity::section('stuart-clark'),
      Identity::media('stuart-clark'),
      Identity::file('stuart-clark'),
      Identity::alias('stuart-clark'),
      Identity::consumer('stuart-clark'),
    ]);
  }

  /**
   * A consumer's UUID is stable per client ID, and distinct from a user's.
   */
  public function testConsumerIsStableAndDistinct(): void {
    $consumer = Identity::consumer('druxtjs_org');
    $this->assertSame($consumer, Identity::consumer('druxtjs_org'));
    $this->assertNotSame($consumer, Identity::consumer('another_frontend'));
    $this->assertNotSame($consumer, Identity::user('druxtjs_org'));
  }

}
