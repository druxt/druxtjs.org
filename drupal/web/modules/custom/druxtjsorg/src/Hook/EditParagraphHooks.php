<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Component\Uuid\Uuid;
use Drupal\Core\Entity\ContentEntityFormInterface;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * Opens a page's form at one of its paragraphs, ready to edit it.
 *
 * Paragraphs have no form of their own that respects moderation and
 * revisions, so the frontend links to the page's form with `?paragraph=` and
 * the builder opens that paragraph's dialog.
 */
final class EditParagraphHooks {

  /**
   * The query parameter naming the paragraph.
   */
  public const QUERY = 'paragraph';

  public function __construct(private readonly RequestStack $requestStack) {}

  /**
   * Implements hook_form_alter().
   */
  #[Hook('form_alter')]
  public function formAlter(array &$form, FormStateInterface $form_state, string $form_id): void {
    $object = $form_state->getFormObject();
    if (!$object instanceof ContentEntityFormInterface || $object->getEntity()->getEntityTypeId() !== 'node') {
      return;
    }
    $uuid = (string) $this->requestStack->getCurrentRequest()?->query->get(self::QUERY, '');
    if (!Uuid::isValid($uuid)) {
      return;
    }
    $form['#attached']['library'][] = 'druxtjsorg/edit-paragraph';
    $form['#attached']['drupalSettings']['druxtjsorg']['editParagraph'] = $uuid;
  }

}
