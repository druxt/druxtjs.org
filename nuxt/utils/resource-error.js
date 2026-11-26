/**
 * Druxt 0.25.2 answers a failed `druxt/getResource` with the stored copy
 * and an `error` holding the response's status, rather than throwing.
 */

/** The HTTP status a failed getResource answered with, or null when it did not fail. */
export const failedStatus = (resource) => {
  const status = Number(((resource || {}).error || {}).statusCode)
  return Number.isFinite(status) && status > 0 ? status : null
}

/**
 * Whether asking again could give a different answer. Drupal's 403 and 404
 * are final for this reader; anything else (a 5xx, a dropped request) may not be.
 */
export const worthRetrying = (resource) => ![403, 404].includes(failedStatus(resource))
