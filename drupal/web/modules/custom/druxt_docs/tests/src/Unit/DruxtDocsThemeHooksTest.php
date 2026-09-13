<?php

declare(strict_types=1);

namespace Drupal\Tests\druxt_docs\Unit;

use Drupal\Core\Field\FieldItemListInterface;
use Drupal\druxt_docs\Hook\DruxtDocsThemeHooks;
use Drupal\paragraphs\ParagraphInterface;
use Drupal\Tests\UnitTestCase;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\Attributes\Group;

/**
 * How block previews in the layout builder are styled.
 */
#[CoversClass(DruxtDocsThemeHooks::class)]
#[Group('druxt_docs')]
final class DruxtDocsThemeHooksTest extends UnitTestCase {

  /**
   * The default view mode stays plain, since Druxt reads that display.
   */
  public function testTheDefaultViewModeIsLeftAlone(): void {
    $variables = $this->variables('default', 'docs_code');
    $before = $variables;
    (new DruxtDocsThemeHooks())->preprocessParagraph($variables);
    self::assertSame($before, $variables);
  }

  /**
   * A preview is set as prose, with the stylesheet that styles it.
   */
  public function testAPreviewIsProseWithTheStylesheet(): void {
    $variables = $this->variables('preview', 'docs_code');
    (new DruxtDocsThemeHooks())->preprocessParagraph($variables);
    self::assertSame(['prose'], $variables['attributes']['class']);
    self::assertSame(['druxt_docs/preview'], $variables['#attached']['library']);
  }

  /**
   * A callout previews with its type as a class.
   */
  public function testACalloutCarriesItsType(): void {
    $variables = $this->variables('preview', 'docs_callout', 'prerequisite');
    (new DruxtDocsThemeHooks())->preprocessParagraph($variables);
    self::assertSame(['prose', 'docs-callout', 'docs-callout--prerequisite'], $variables['attributes']['class']);
  }

  /**
   * The template variables for a paragraph in a view mode.
   */
  private function variables(string $view_mode, string $bundle, ?string $callout_type = NULL): array {
    $type = $this->createMock(FieldItemListInterface::class);
    $type->method('isEmpty')->willReturn($callout_type === NULL);
    $type->method('__get')->with('value')->willReturn($callout_type);
    $paragraph = $this->createMock(ParagraphInterface::class);
    $paragraph->method('bundle')->willReturn($bundle);
    $paragraph->method('get')->with('field_callout_type')->willReturn($type);
    return ['view_mode' => $view_mode, 'paragraph' => $paragraph, 'attributes' => []];
  }

}
