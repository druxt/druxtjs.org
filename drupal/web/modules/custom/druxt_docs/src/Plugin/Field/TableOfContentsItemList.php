<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\Field;

use Drupal\Core\Cache\CacheableDependencyInterface;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Entity\EntityPublishedInterface;
use Drupal\Core\Field\FieldItemList;
use Drupal\Core\TypedData\ComputedItemListTrait;
use Drupal\druxt_docs\Toc\TableOfContents;
use Drupal\layout_paragraphs\LayoutParagraphsComponent;
use Drupal\layout_paragraphs\LayoutParagraphsLayout;
use Drupal\paragraphs\ParagraphInterface;

/**
 * A page's table of contents, computed from its content whenever it is read.
 *
 * The page's current paragraphs are read in the order layout_paragraphs
 * renders them: section by section, and within a section, region by region
 * in the order its layout declares them. Markdown blocks give the headings in
 * their source, as the IR builder reads them. Rich text blocks give the
 * headings in the HTML their text format renders, which is what Druxt shows.
 * A block readers never see, because it or its section is unpublished or
 * layout_paragraphs has disabled it, gives none.
 *
 * The value depends on every paragraph read and every text format rendered,
 * so their cache tags are this field's, and JSON:API adds them to the page's
 * response.
 */
final class TableOfContentsItemList extends FieldItemList implements CacheableDependencyInterface {

  use ComputedItemListTrait;

  /**
   * The field holding a page's paragraphs.
   */
  private const CONTENT = 'field_content';

  /**
   * The field each block type keeps its text in, and the text's format.
   */
  private const TEXT = [
    'docs_text' => ['field_text', 'markdown'],
    'docs_rich_text' => ['field_rich_text', 'html'],
  ];

  /**
   * The paragraphs the value was computed from, as cacheability.
   */
  private ?CacheableMetadata $cacheability = NULL;

  /**
   * {@inheritdoc}
   */
  protected function computeValue(): void {
    $this->cacheability = new CacheableMetadata();
    $entity = $this->getEntity();
    if (!$entity->hasField(self::CONTENT)) {
      return;
    }
    $layout = new LayoutParagraphsLayout($entity->get(self::CONTENT));
    $blocks = [];
    foreach ($layout->getRootComponents() as $component) {
      foreach ($this->inReadingOrder($layout, $component) as $paragraph) {
        $block = $this->text($paragraph);
        if ($block !== NULL) {
          $blocks[] = $block;
        }
      }
    }
    foreach (TableOfContents::build($blocks) as $delta => $entry) {
      $this->list[$delta] = $this->createItem($delta, $entry);
    }
  }

  /**
   * The visible paragraphs a component renders: itself, or its regions'.
   *
   * @return \Generator<\Drupal\paragraphs\ParagraphInterface>
   *   The paragraphs, in reading order.
   */
  private function inReadingOrder(LayoutParagraphsLayout $layout, LayoutParagraphsComponent $component): \Generator {
    $paragraph = $this->translated($component->getEntity());
    $this->cacheability->addCacheableDependency($paragraph);
    if ($paragraph instanceof EntityPublishedInterface && !$paragraph->isPublished()) {
      return;
    }
    if (!$component->isLayout()) {
      yield $paragraph;
      return;
    }
    $section = $layout->getLayoutSection($component->getEntity());
    $definition = \Drupal::service('plugin.manager.core.layout')->getDefinition($section->getLayoutId(), FALSE);
    foreach ($definition?->getRegionNames() ?? [] as $region) {
      foreach ($section->getComponentsForRegion($region) as $child) {
        yield from $this->inReadingOrder($layout, $child);
      }
    }
  }

  /**
   * A block's text, in the form its headings are read from.
   *
   * Markdown is its source. Rich text is what its text format renders, so a
   * heading the format strips is not a heading here either.
   *
   * @return array{markdown: string}|array{html: string}|null
   *   The text, or NULL for a block that has none.
   */
  private function text(ParagraphInterface $paragraph): ?array {
    [$field, $format] = self::TEXT[$paragraph->bundle()] ?? [NULL, NULL];
    $item = $field !== NULL && $paragraph->hasField($field) ? $paragraph->get($field)->first() : NULL;
    if ($item === NULL) {
      return NULL;
    }
    if ($format === 'markdown') {
      return ['markdown' => (string) $item->value];
    }
    $processed = $item->get('processed');
    $this->cacheability->addCacheableDependency($processed);
    return ['html' => (string) $processed->getValue()];
  }

  /**
   * A paragraph in the page's language, where it has that translation.
   */
  private function translated(ParagraphInterface $paragraph): ParagraphInterface {
    $langcode = $this->getLangcode();
    return $paragraph->hasTranslation($langcode) ? $paragraph->getTranslation($langcode) : $paragraph;
  }

  /**
   * {@inheritdoc}
   */
  public function getCacheContexts(): array {
    return $this->cacheability()->getCacheContexts();
  }

  /**
   * {@inheritdoc}
   */
  public function getCacheTags(): array {
    return $this->cacheability()->getCacheTags();
  }

  /**
   * {@inheritdoc}
   */
  public function getCacheMaxAge(): int {
    return $this->cacheability()->getCacheMaxAge();
  }

  /**
   * The cacheability of the computed value, computing it first if need be.
   */
  private function cacheability(): CacheableMetadata {
    $this->ensureComputedValue();
    return $this->cacheability ?? new CacheableMetadata();
  }

}
