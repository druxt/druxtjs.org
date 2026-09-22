<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

/**
 * What the frontend's OAuth consumer must be for its sign-in to work.
 *
 * The importer creates the consumer with these values, but only on a site it
 * seeds. An environment that copies production's database has whatever
 * production has, and its own frontend's callback is in no list, so every
 * rollout applies this.
 */
final class OAuthClient {

  /**
   * The consumer's client ID.
   */
  public const CLIENT_ID = 'druxtjs_org';

  /**
   * The scopes an editor's sign-in may ask for.
   */
  public const SCOPES = ['authenticated', 'editor', 'contributor', 'administrator'];

  /**
   * The field values the consumer needs.
   *
   * @param string[] $redirects
   *   The consumer's current redirect URIs.
   * @param string|null $frontend
   *   This environment's frontend origin, if it has one.
   *
   * @return array<string, mixed>
   *   Field values, keyed by field name.
   */
  public static function values(array $redirects, ?string $frontend): array {
    if ($frontend) {
      $redirects[] = rtrim($frontend, '/') . '/callback';
    }
    return [
      'confidential' => FALSE,
      'pkce' => TRUE,
      'automatic_authorization' => TRUE,
      'grant_types' => ['authorization_code', 'refresh_token'],
      'authorization_code_scopes' => self::SCOPES,
      'redirect' => array_values(array_unique(array_filter($redirects))),
    ];
  }

}
