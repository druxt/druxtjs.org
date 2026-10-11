<?php

declare(strict_types=1);

namespace Drupal\druxtjsorg;

use Symfony\Component\Uid\Uuid;

/**
 * Gives a documentation topic the same UUID on every site.
 *
 * The deploy hook creates the topics by name, so each environment minted its
 * own random UUID, and a node deployed between sites named a topic the
 * target did not have. The section terms carry version 5 UUIDs and match
 * everywhere; the topics now follow them.
 */
final class TopicUuid {

  /**
   * Returns the UUID for a topic name.
   */
  public static function for(string $name): string {
    return Uuid::v5(Uuid::fromString(Uuid::NAMESPACE_URL), 'https://druxtjs.org/documentation_topic/' . $name)->toRfc4122();
  }

}
