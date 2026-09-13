<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\Core\Site\Settings;
use Drupal\druxt_docs\PreviewUrl;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * How the frontend preview URL is built from its settings template.
 */
#[CoversClass(PreviewUrl::class)]
#[Group('druxt_docs')]
final class PreviewUrlTest extends UnitTestCase {

  private const UUID = '6f1c1a4e-0b1d-4c55-9a55-3c2a8f0f2c11';

  /**
   * Without the setting there is no frontend preview.
   */
  public function testThereIsNoPreviewWithoutTheSetting(): void {
    new Settings([]);
    self::assertNull(PreviewUrl::frontend(self::UUID, 'full'));
  }

  /**
   * A blank setting is the same as none.
   */
  public function testABlankSettingIsTheSameAsNone(): void {
    self::assertNull($this->frontend(' '));
  }

  /**
   * The UUID and view mode fill in their placeholders.
   */
  public function testThePlaceholdersAreFilledIn(): void {
    self::assertSame(
      '/druxt/node/preview?vm=full#/jsonapi/node/doc_page/' . self::UUID . '/preview',
      $this->frontend('/druxt/node/preview?vm={view_mode}#/jsonapi/node/doc_page/{uuid}/preview'),
    );
  }

  /**
   * A placeholder used twice is filled in twice.
   */
  public function testEveryOccurrenceIsFilledIn(): void {
    self::assertSame('/p/' . self::UUID . '?id=' . self::UUID, $this->frontend('/p/{uuid}?id={uuid}'));
  }

  /**
   * A frontend on another origin keeps its scheme and host.
   */
  public function testAnAbsoluteUrlIsKept(): void {
    self::assertSame(
      'https://druxtjs.org/preview/' . self::UUID . '?vm=teaser',
      $this->frontend('https://druxtjs.org/preview/{uuid}?vm={view_mode}', 'teaser'),
    );
  }

  /**
   * The values are encoded, so they cannot change the URL's structure.
   */
  public function testTheValuesAreEncoded(): void {
    self::assertSame('/p?vm=a%20b%26c', $this->frontend('/p?vm={view_mode}', 'a b&c'));
  }

  /**
   * A script URL cannot reach the iframe.
   */
  public function testAScriptUrlIsDisarmed(): void {
    self::assertStringStartsNotWith('javascript:', (string) $this->frontend('javascript:alert("{uuid}")'));
  }

  /**
   * The frontend preview URL under a template.
   */
  private function frontend(string $template, string $view_mode = 'full'): ?string {
    new Settings(['druxt_docs_preview_url' => $template]);
    return PreviewUrl::frontend(self::UUID, $view_mode);
  }

}
