<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg\Hook;

use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\image\ImageStyleInterface;
use Drupal\user\UserInterface;

/**
 * The account's picture and roles, in the OpenID Connect userinfo.
 *
 * The frontend's account menu shows both, and userinfo is the one request it
 * already makes for the account.
 */
final class UserClaimsHooks {

  /**
   * The image style the picture is served at: square, and small.
   */
  public const STYLE = 'thumbnail';

  public function __construct(private readonly EntityTypeManagerInterface $entityTypeManager) {}

  /**
   * Implements hook_simple_oauth_oidc_claims_alter().
   */
  #[Hook('simple_oauth_oidc_claims_alter')]
  public function claimsAlter(array &$claim_values, array &$context): void {
    $user = $this->entityTypeManager->getStorage('user')->load($context['account']->id());
    if (!$user instanceof UserInterface) {
      return;
    }
    $claim_values['roles'] = array_values(array_diff($user->getRoles(), ['authenticated']));
    $claim_values['picture'] = $this->pictureOf($user);
  }

  /**
   * The picture's URL, at the image style, or NULL without one.
   */
  private function pictureOf(UserInterface $user): ?string {
    if (!$user->hasField('user_picture') || $user->get('user_picture')->isEmpty()) {
      return NULL;
    }
    $file = $user->get('user_picture')->entity;
    if (!$file) {
      return NULL;
    }
    $style = $this->entityTypeManager->getStorage('image_style')->load(self::STYLE);
    $uri = $file->getFileUri();
    return $style instanceof ImageStyleInterface
      ? $style->buildUrl($uri)
      : \Drupal::service('file_url_generator')->generateAbsoluteString($uri);
  }

}
