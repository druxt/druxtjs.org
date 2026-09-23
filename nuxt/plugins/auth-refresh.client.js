import { RETRIED, shouldRefresh } from '~/lib/auth-retry'

/**
 * One 401, one refresh, one retry.
 *
 * Saving an account in Drupal deletes its access tokens, so an editor who
 * edits their own profile comes back to a site that believes it is signed in
 * and whose every request is refused. The refresh token outlives the save, so
 * asking for a new access token puts the editor back where they were without
 * them seeing anything.
 *
 * The refresh is shared, and for longer than it is in flight. Each refresh
 * rotates the tokens and revokes the access token the one before it issued,
 * so a second refresh kills the token the first just handed out and the
 * request carrying it is refused. Sharing only the in-flight promise is not
 * enough: a burst of requests fails in waves, and the wave that arrives just
 * after a refresh finishes would start another. So a refusal that lands
 * within a moment of a good refresh is retried with the token that refresh
 * produced, and asks for nothing new.
 */
export default function (context) {
  const { $druxt, $axios } = context

  // Read from the context rather than from the arguments: the authentication
  // module injects `$auth` after this plugin runs, so a plugin that took it
  // as an argument would hold nothing and quietly never retry anything.
  const auth = () => context.$auth || (context.app && context.app.$auth)

  /** How long a fresh token is taken to be fresh, in milliseconds. */
  const GRACE = 5000

  let refreshing = null
  let refreshedAt = 0
  const refresh = () => {
    // Just refreshed: the token in hand is the one a refresh would fetch, so
    // the request is retried with it rather than rotating the tokens again.
    // `refreshedAt` guards the subtraction: before the first refresh it is 0,
    // and against a clock that starts at 0 the first refusal would take the
    // grace path and never refresh at all.
    if (!refreshing && refreshedAt && Date.now() - refreshedAt < GRACE) {
      return Promise.resolve()
    }
    if (!refreshing) {
      refreshing = auth()
        .refreshTokens()
        .then((result) => {
          refreshedAt = Date.now()
          return result
        })
        .finally(() => {
          refreshing = null
        })
    }
    return refreshing
  }

  const state = () => {
    const $auth = auth()
    const strategy = $auth && $auth.strategy
    return {
      loggedIn: Boolean($auth && $auth.loggedIn),
      hasRefreshToken: Boolean(strategy && strategy.refreshToken && strategy.refreshToken.get()),
    }
  }

  const attach = (instance) => {
    if (!instance || !instance.interceptors) return
    instance.interceptors.response.use(undefined, async (error) => {
      if (!shouldRefresh(error, state())) throw error
      try {
        await refresh()
      } catch (failed) {
        // The refresh token is gone too, so this is a real sign-out, and the
        // original answer is what the caller should see.
        throw error
      }
      const config = { ...error.config, [RETRIED]: true }
      const strategy = auth().strategy
      const token = strategy && strategy.token && strategy.token.get()
      if (token) config.headers = { ...config.headers, Authorization: token }
      return instance.request(config)
    })
  }

  attach($druxt && $druxt.axios)
  // The same instance in most sites, and harmless where it is not.
  if ($axios && $druxt && $axios !== $druxt.axios) attach($axios)
}
