<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

/**
 * Lets this environment's frontend read a preview with its preview token.
 *
 * A preview target with a token sends the frontend Consumer Node Preview's
 * endpoint on this site, and the frontend's browser asks it directly, with
 * the token in an Authorization header and without cookies. That is a
 * cross-origin request with a preflight, which core's CORS support answers
 * once it is on.
 *
 * Only the frontend's origin is allowed, for GET with the headers the
 * preview sends, and never with credentials: a request that carries a token
 * needs no cookie, and a page on another origin cannot read with the
 * editor's session.
 */
final class PreviewCors {

  /**
   * The methods a preview reads with.
   */
  public const METHODS = ['GET'];

  /**
   * The headers a preview sends.
   */
  public const HEADERS = ['accept', 'authorization'];

  /**
   * The CORS settings with the frontend allowed.
   *
   * @param array<string, mixed> $cors
   *   Core's cors.config parameter.
   * @param string|null $frontend
   *   The frontend's URL, from the druxt_docs_frontend_url setting.
   *
   * @return array<string, mixed>
   *   The parameter, unchanged when there is no frontend.
   */
  public static function config(array $cors, ?string $frontend): array {
    $parts = parse_url((string) $frontend);
    if (!is_array($parts) || !in_array($parts['scheme'] ?? '', ['http', 'https'], TRUE) || empty($parts['host'])) {
      return $cors;
    }
    $origin = $parts['scheme'] . '://' . $parts['host'] . (isset($parts['port']) ? ':' . $parts['port'] : '');
    // Core's default allows every origin, which only matters once CORS is on:
    // turning it on here allows the frontend and the origins a site named.
    $origins = !empty($cors['enabled']) ? (array) ($cors['allowedOrigins'] ?? []) : [];
    $origins = in_array('*', $origins, TRUE) ? ['*'] : array_values(array_unique([...$origins, $origin]));
    $lower = fn (array $values): array => array_map('strtolower', $values);
    return [
      ...$cors,
      'enabled' => TRUE,
      'allowedOrigins' => $origins,
      'allowedMethods' => array_values(array_unique([...(array) ($cors['allowedMethods'] ?? []), ...self::METHODS])),
      'allowedHeaders' => array_values(array_unique([
        ...$lower((array) ($cors['allowedHeaders'] ?? [])),
        ...self::HEADERS,
      ])),
      'supportsCredentials' => !empty($cors['enabled']) && !empty($cors['supportsCredentials']),
    ];
  }

}
