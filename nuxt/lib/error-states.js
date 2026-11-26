/**
 * What the error page says for each status the site renders.
 *
 * Shared by layouts/error.vue, for the title, and components/app/ErrorState.vue,
 * for the body, so the two name the same state. A 401 or 403 is Drupal
 * refusing the request, not a missing page.
 */
const STATES = {
  401: {
    heading: 'Your sign-in has expired',
    message: 'Drupal no longer accepts your sign-in, so this page cannot be shown. Sign in again to carry on.',
  },
  403: {
    heading: 'You cannot see this page',
    message: 'Your account may not read this page. Sign in with an account that can, or go back.',
  },
  404: {
    heading: 'Page not found',
    message: 'That page does not exist. It may have moved, or the link that brought you here may be out of date.',
  },
}

const FALLBACK = {
  heading: 'Something went wrong',
  message: 'An unexpected error occurred while loading this page.',
}

/**
 * The heading and message for a status.
 *
 * @param {number} statusCode - The HTTP status the page represents.
 * @returns {{ heading: string, message: string }} What the page says.
 */
export const errorState = (statusCode) => STATES[statusCode] || FALLBACK
