<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

/**
 * What the frontend's OAuth consumer must be for its sign-in to work.
 *
 * A fresh site has no consumer, so it is created with the initial values. An
 * environment that copies production's database has whatever production has,
 * and its own frontend's callback is in no list, so every rollout applies
 * these.
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
   * The values a new consumer starts with, before the ones it needs.
   *
   * @return array<string, mixed>
   *   Field values, keyed by field name.
   */
  public static function initial(): array {
    return [
      'client_id' => self::CLIENT_ID,
      'label' => 'druxtjs.org',
      'description' => 'The documentation site. A public client: the password grant for editors, and authorization code with PKCE, approved by a person, for a client outside the site.',
      'decoupled_settings_theme' => 'druxtjs',
      'redirect' => ['https://druxtjs.org/callback', 'http://localhost:3000/callback'],
    ];
  }

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
      // The site signs editors in with the password grant, which never shows
      // the authorize screen. A person approves each authorization code
      // grant: an automatic one would hand whatever answers a registered
      // callback an administrator's token.
      'automatic_authorization' => FALSE,
      'grant_types' => ['authorization_code', 'password', 'refresh_token'],
      'authorization_code_scopes' => self::SCOPES,
      'redirect' => array_values(array_unique(array_filter($redirects))),
    ];
  }

}
