<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

/**
 * What the frontend needs to register its own preview target.
 *
 * When the frontend starts, @druxt-contrib/node-preview signs in with the
 * client credentials grant and writes its target to its consumer through
 * Consumer Node Preview's API. That takes a confidential consumer of its own,
 * not the sign-in one, which is public, and a user that owns the consumer and
 * holds only the permission to change its targets. The token acts as that
 * user. Every rollout applies these, as it does for the sign-in consumer.
 *
 * A target with a preview token lets a frontend on another site read the
 * editor's preview without the editor's session. Consumer Node Preview issues
 * that token only to a consumer with the authorization code grant, with the
 * scopes the editor would get by signing in to it: the sign-in consumer's.
 */
final class PreviewRegistrar {

  /**
   * The consumer's client ID, which the frontend names.
   */
  public const CLIENT_ID = 'druxtjs_org_preview';

  /**
   * The user the token acts as. Nobody signs in as it.
   */
  public const USER = 'frontend_registrar';

  /**
   * The role that holds the permission, and nothing else.
   */
  public const ROLE = 'preview_target_registrar';

  /**
   * The scope that grants the role to a client credentials token.
   */
  public const SCOPE = 'preview_targets';

  /**
   * The environment variable the consumer's secret comes from.
   *
   * The frontend reads the same variable, so one Lagoon variable serves both.
   */
  public const SECRET_VARIABLE = 'DRUXT_NODE_PREVIEW_CLIENT_SECRET';

  /**
   * The values a new user starts with.
   *
   * @return array<string, mixed>
   *   Field values, keyed by field name.
   */
  public static function user(): array {
    return [
      'name' => self::USER,
      // An address on a reserved domain, which no mail reaches.
      'mail' => self::USER . '@druxtjs.invalid',
      'status' => 1,
    ];
  }

  /**
   * The values a new consumer starts with, before the ones it needs.
   *
   * @return array<string, mixed>
   *   Field values, keyed by field name.
   */
  public static function initial(): array {
    return [
      'client_id' => self::CLIENT_ID,
      // The preview's Frontend picker heads this consumer's targets with
      // this, above each target's own label, the frontend's host.
      'label' => 'Frontend',
      'description' => 'The documentation site registering its preview target. A confidential client: the client credentials grant, as a user that may change this consumer\'s preview targets and nothing else, and the authorization code grant, for the preview tokens an editor\'s preview reads with.',
    ];
  }

  /**
   * The field values the consumer needs.
   *
   * @param int $uid
   *   The registrar's user ID.
   *
   * @return array<string, mixed>
   *   Field values, keyed by field name.
   */
  public static function values(int $uid): array {
    return [
      'confidential' => TRUE,
      'third_party' => TRUE,
      'is_default' => FALSE,
      'grant_types' => ['client_credentials', 'authorization_code'],
      // The client credentials token's scope: the registrar's role.
      'scopes' => [self::SCOPE],
      // A preview token's: what the editor gets by signing in, and never
      // more, since a token's roles are only those the editor holds.
      'authorization_code_scopes' => OAuthClient::SCOPES,
      // The client credentials user, whom the token acts as.
      'user_id' => $uid,
      // Consumer Node Preview lets a user change only the targets of a
      // consumer it owns. The consumer form has no field for it.
      'owner_id' => $uid,
    ];
  }

}
