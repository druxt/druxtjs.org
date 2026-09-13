<?php

declare(strict_types=1);

namespace Drupal\druxt_docs\Plugin\migrate\process;

use Drupal\Core\Plugin\ContainerFactoryPluginInterface;
use Drupal\migrate\Attribute\MigrateProcess;
use Drupal\migrate\MigrateException;
use Drupal\migrate\MigrateExecutableInterface;
use Drupal\migrate\Plugin\MigrationPluginManagerInterface;
use Drupal\migrate\ProcessPluginBase;
use Drupal\migrate\Row;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * A menu link's URI: a documentation page's node, or a given URI.
 *
 * The source is `[page, uri]`. A page is the source path of a migrated
 * page, and becomes `entity:node/NID`, so the link follows the node rather
 * than a path that could change. Otherwise the URI is used as given, for a
 * frontend route or an external site. Exactly one of the two must be set.
 *
 * @code
 * link/uri:
 *   plugin: docs_menu_uri
 *   migration: docs_page
 *   source:
 *     - page
 *     - uri
 * @endcode
 */
#[MigrateProcess(id: 'docs_menu_uri', handle_multiples: TRUE)]
final class DocsMenuUri extends ProcessPluginBase implements ContainerFactoryPluginInterface {

  public function __construct(
    array $configuration,
    string $plugin_id,
    mixed $plugin_definition,
    private readonly MigrationPluginManagerInterface $migrationManager,
  ) {
    parent::__construct($configuration, $plugin_id, $plugin_definition);
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container, array $configuration, $plugin_id, $plugin_definition): self {
    return new self($configuration, $plugin_id, $plugin_definition, $container->get('plugin.manager.migration'));
  }

  /**
   * {@inheritdoc}
   */
  public function transform($value, MigrateExecutableInterface $migrate_executable, Row $row, $destination_property): string {
    [$page, $uri] = array_values(is_array($value) ? $value : [$value]) + [NULL, NULL];
    $page = is_string($page) && $page !== '' ? $page : NULL;
    $uri = is_string($uri) && $uri !== '' ? $uri : NULL;
    if (($page === NULL) === ($uri === NULL)) {
      throw new MigrateException('docs_menu_uri: a link needs exactly one of a page or a URI.');
    }
    if ($uri !== NULL) {
      return $uri;
    }
    $name = $this->configuration['migration'] ?? '';
    $migration = $name !== '' ? $this->migrationManager->createInstance($name) : NULL;
    if ($migration === NULL) {
      throw new MigrateException(sprintf('docs_menu_uri: there is no "%s" migration.', $name));
    }
    $destination = $migration->getIdMap()->lookupDestinationIds([$page]);
    $nid = $destination ? reset($destination)[0] ?? NULL : NULL;
    if ($nid === NULL) {
      throw new MigrateException(sprintf('docs_menu_uri: %s has no page. Run %s first.', $page, $name));
    }
    return 'entity:node/' . $nid;
  }

}
