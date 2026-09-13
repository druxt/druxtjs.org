<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\source;

use Drupal\migrate\Attribute\MigrateSource;
use Drupal\migrate\MigrateException;

/**
 * One row per distinct image, with the alt text every page agrees on.
 *
 * An image used on two pages is one media entity, so the rows are keyed by
 * path rather than by use. Two pages giving the same image different alt
 * text is a defect in the corpus rather than a choice to make here, so it
 * stops the run.
 */
#[MigrateSource(id: 'docs_image')]
final class DocsImage extends DocsSourceBase {

  /**
   * {@inheritdoc}
   */
  public function fields(): array {
    return [
      'src' => 'Path of the image, as the markdown writes it',
      'alt' => 'Alt text, which every use of the image must agree on',
      'path' => 'Absolute path of the file the builder copied',
      'basename' => 'File name',
    ];
  }

  /**
   * {@inheritdoc}
   */
  public function getIds(): array {
    return ['src' => ['type' => 'string']];
  }

  /**
   * {@inheritdoc}
   */
  protected function initializeIterator(): \Iterator {
    $directory = $this->directory();
    $images = [];
    foreach ($this->documents() as $page => $document) {
      foreach ($document['blocks'] as $index => $block) {
        if (($block['type'] ?? '') !== 'image') {
          continue;
        }
        $src = $block['src'] ?? '';
        $alt = $block['alt'] ?? '';
        if ($src === '' || $alt === '') {
          throw new MigrateException(sprintf('%s block %d: an image needs a src and alt text.', $page, $index));
        }
        if (isset($images[$src]) && $images[$src]['alt'] !== $alt) {
          throw new MigrateException(sprintf('%s block %d: %s already has the alt text %s, and this use gives it %s. One image carries one alt text.', $page, $index, $src, json_encode($images[$src]['alt']), json_encode($alt)));
        }
        $basename = basename($src);
        try {
          $path = self::imagePath($directory, $src);
        }
        catch (\InvalidArgumentException $exception) {
          throw new MigrateException(sprintf('%s block %d: %s', $page, $index, $exception->getMessage()));
        }
        if (!is_file($path)) {
          throw new MigrateException(sprintf('%s block %d: %s is not in the intermediate representation at %s.', $page, $index, $src, $path));
        }
        $images[$src] = ['src' => $src, 'alt' => $alt, 'path' => $path, 'basename' => $basename];
      }
    }
    if ($images === []) {
      throw new MigrateException('docs_image: the corpus has no images, which it has never had.');
    }
    ksort($images);
    return new \ArrayIterator(array_values($images));
  }

  /**
   * Where an image's file is, inside the intermediate representation.
   *
   * @param string $directory
   *   The intermediate representation directory.
   * @param string $src
   *   The image's src, a path under its static directory.
   *
   * @return string
   *   The file's path, which may not exist.
   *
   * @throws \InvalidArgumentException
   *   When the src reaches outside the static directory.
   */
  public static function imagePath(string $directory, string $src): string {
    $static = rtrim($directory, '/') . '/static';
    $path = $static . '/' . ltrim($src, '/');
    $realStatic = realpath($static);
    $realPath = realpath($path);
    if ($realStatic !== FALSE && $realPath !== FALSE && !str_starts_with($realPath, $realStatic . '/')) {
      throw new \InvalidArgumentException(sprintf('%s reaches outside the intermediate representation.', $src));
    }
    return $path;
  }

}
