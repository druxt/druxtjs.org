<?php

declare(strict_types=1);

namespace Drupal\jsonapi\Normalizer\ImpostorFrom\druxtjsorg;

use Drupal\druxtjsorg\Normalizer\SerializedFieldItemNormalizer;

/**
 * Lends the serialized field item normalizer a class name JSON:API accepts.
 *
 * @see \Drupal\jsonapi\Serializer\Serializer::__construct()
 * @see \Drupal\druxtjsorg\DruxtjsorgServiceProvider::swapFieldItemNormalizer()
 */
class SerializedFieldItemNormalizerImpostor extends SerializedFieldItemNormalizer {}
