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
 * The refresh is shared: a page that fires several requests at once must not
 * fire several refreshes, because each one rotates the refresh token and the
 * losers of that race would be left holding a token that no longer works.
 */
export default function (context) {
  const { $druxt, $axios } = context

  // Read from the context rather than from the arguments: the authentication
  // module injects `$auth` after this plugin runs, so a plugin that took it
  // as an argument would hold nothing and quietly never retry anything.
  const auth = () => context.$auth || (context.app && context.app.$auth)

  let refreshing = null
  const refresh = () => {
    if (!refreshing) {
      refreshing = auth()
        .refreshTokens()
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
