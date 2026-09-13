<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\druxt_docs\Plugin\migrate\source\DocsImage;
use Drupal\Tests\UnitTestCase;

/**
 * Where an image block's file is found, and where it may not reach.
 *
 * @coversDefaultClass \Drupal\druxt_docs\Plugin\migrate\source\DocsImage
 * @group druxt_docs
 */
final class DocsImageTest extends UnitTestCase {

  /**
   * An intermediate representation directory with one static file.
   */
  private string $directory;

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    $this->directory = sys_get_temp_dir() . '/druxt-docs-images-' . uniqid();
    mkdir($this->directory . '/static/images', 0777, TRUE);
    file_put_contents($this->directory . '/static/images/ok.png', 'png');
    file_put_contents($this->directory . '/secret.txt', 'not an image');
  }

  /**
   * {@inheritdoc}
   */
  protected function tearDown(): void {
    foreach (['/static/images/ok.png', '/secret.txt'] as $file) {
      @unlink($this->directory . $file);
    }
    @rmdir($this->directory . '/static/images');
    @rmdir($this->directory . '/static');
    @rmdir($this->directory);
    parent::tearDown();
  }

  /**
   * A src under the static directory resolves to its file.
   */
  public function testSrcResolvesUnderStatic(): void {
    $path = DocsImage::imagePath($this->directory, '/images/ok.png');
    $this->assertSame($this->directory . '/static/images/ok.png', $path);
    $this->assertFileExists($path);
  }

  /**
   * A src that climbs out of the static directory is refused, not copied.
   */
  public function testSrcMayNotReachOutsideStatic(): void {
    $this->expectException(\InvalidArgumentException::class);
    $this->expectExceptionMessageMatches('/reaches outside the intermediate representation/');
    DocsImage::imagePath($this->directory, '../secret.txt');
  }

  /**
   * A missing file is still reported as missing, by the path looked for.
   */
  public function testMissingFileKeepsItsPath(): void {
    $path = DocsImage::imagePath($this->directory, '/images/absent.png');
    $this->assertSame($this->directory . '/static/images/absent.png', $path);
    $this->assertFileDoesNotExist($path);
  }

}
