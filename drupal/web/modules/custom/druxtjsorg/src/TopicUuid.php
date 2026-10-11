<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

/**
 * Gives a documentation topic the same UUID on every site.
 *
 * The deploy hook creates the topics by name, so each environment minted its
 * own random UUID, and a node deployed between sites named a topic the
 * target did not have. The section terms carry version 5 UUIDs and match
 * everywhere; the topics now follow them. The derivation is RFC 4122
 * version 5 by hand, so the site adds no dependency for it.
 */
final class TopicUuid {

  /**
   * The RFC 4122 URL namespace, as bytes.
   */
  private const NAMESPACE_URL = "\x6b\xa7\xb8\x11\x9d\xad\x11\xd1\x80\xb4\x00\xc0\x4f\xd4\x30\xc8";

  /**
   * Returns the UUID for a topic name.
   */
  public static function for(string $name): string {
    $hash = sha1(self::NAMESPACE_URL . 'https://druxtjs.org/documentation_topic/' . $name, TRUE);
    $bytes = substr($hash, 0, 16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x50);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf('%s-%s-%s-%s-%s', substr($hex, 0, 8), substr($hex, 8, 4), substr($hex, 12, 4), substr($hex, 16, 4), substr($hex, 20, 12));
  }

}
