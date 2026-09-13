<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\source;

use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\Core\State\StateInterface;
use Drupal\druxt_docs\IntermediateRepresentation;
use Drupal\migrate\MigrateException;
use Drupal\migrate\Plugin\MigrationInterface;
use Drupal\migrate\Plugin\migrate\source\SourcePluginBase;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * Reads the intermediate representation directory once, for its subclasses.
 *
 * The directory is a build artifact rather than committed content, so it
 * is not something a migration definition can name. It comes from state,
 * which the import script sets before running anything, and a migration
 * may override it for a test. A missing or unreadable directory is an
 * exception rather than an empty result: a migration that reports zero
 * rows and exits cleanly is the failure this pipeline keeps defending
 * against.
 */
abstract class DocsSourceBase extends SourcePluginBase implements ContainerFactoryPluginInterface {

  /**
   * State key holding the intermediate representation directory.
   */
  public const DIRECTORY_STATE = 'druxt_docs.ir_directory';

  public function __construct(
    array $configuration,
    string $plugin_id,
    mixed $plugin_definition,
    MigrationInterface $migration,
    private readonly StateInterface $state,
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition, $migration);
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition, ?MigrationInterface $migration = NULL): static {
    return new static($configuration, $plugin_id, $plugin_definition, $migration, $container->get('state'));
  }

  /**
   * The directory the build wrote, from the migration or from state.
   */
  protected function directory(): string {
    $directory = $this->configuration['directory'] ?? $this->state->get(self::DIRECTORY_STATE, '');
    if (!is_string($directory) || $directory === '') {
      throw new MigrateException(sprintf('%s: no intermediate representation directory. Set the %s state to the directory the build wrote.', $this->pluginId, self::DIRECTORY_STATE));
    }
    return $directory;
  }

  /**
   * The documents, keyed by source path.
   *
   * @var array<string, array>|null
   */
  private ?array $documents = NULL;

  /**
   * The documents the intermediate representation holds.
   *
   * @return array<string, array>
   *   Documents keyed by source path, in the order the builder wrote them.
   */
  protected function documents(): array {
    if ($this->documents !== NULL) {
      return $this->documents;
    }
    $directory = $this->directory();
    $documents = IntermediateRepresentation::load($directory, $error);
    if ($documents === NULL) {
      throw new MigrateException(sprintf('%s: %s', $this->pluginId, $error));
    }
    if ($documents === []) {
      throw new MigrateException(sprintf('%s: %s holds no documents. An empty source is a build failure, not an empty migration.', $this->pluginId, $directory));
    }
    $keyed = [];
    foreach ($documents as $document) {
      $keyed[$document['source']] = $document;
    }
    return $this->documents = $keyed;
  }

  /**
   * {@inheritdoc}
   */
  public function __toString(): string {
    return $this->pluginId;
  }

}
