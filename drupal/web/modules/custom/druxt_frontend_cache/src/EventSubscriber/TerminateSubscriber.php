<?php

declare(strict_types=1);

namespace Drupal\druxt_frontend_cache\EventSubscriber;

use Drupal\druxt_frontend_cache\Notifier;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Sends the pending cache clear once the response is out of the door.
 */
final class TerminateSubscriber implements EventSubscriberInterface {

  public function __construct(
    private readonly Notifier $notifier,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [KernelEvents::TERMINATE => ['onTerminate']];
  }

  /**
   * Clears the frontend's cache if this request changed anything.
   */
  public function onTerminate(): void {
    $this->notifier->flush();
  }

}
