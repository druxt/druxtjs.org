import { AUTH_STRATEGY, authStorageKeys } from '~/lib/auth'

/**
 * A real sign-out. `$auth.logout()` alone only drops the local token: it is
 * not revoked, and the DruxtStore keeps whatever the editor fetched until the
 * page reloads. So this revokes the token server-side (best effort, since the
 * backend may be gone), clears the auth storage @nuxtjs/auth-next leaves as
 * "false", and does a full page load, which is what empties the store.
 *
 * @param {object} context - The Nuxt context.
 * @param {Function} inject - Nuxt's injector.
 */
export default function (context, inject) {
  inject('signOut', async () => {
    const { app } = context
    const $auth = app.$auth
    const strategy = ($auth && $auth.strategy) || {}
    const clientId = (strategy.options || {}).clientId
    const raw = strategy.token && strategy.token.get && strategy.token.get()
    const token = raw ? String(raw).replace(/^Bearer\s+/i, '') : null

    // Revoke first, and keep going whatever it answers: a spent or unrevoked
    // token must still not leave the editor looking signed in.
    if (token && clientId) {
      try {
        await app.$druxt.axios.post(
          '/oauth/revoke',
          new URLSearchParams({ token, client_id: clientId }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        )
      } catch (e) {
        // The backend may be unreachable; the local sign-out below still runs.
      }
    }

    try {
      await $auth.logout()
    } catch (e) {
      // logout() can reject if the token is already gone; the clear covers it.
    }

    for (const key of authStorageKeys(AUTH_STRATEGY)) {
      try {
        document.cookie = `${key}=; Path=/; Max-Age=0`
        window.localStorage.removeItem(key)
      } catch (e) {
        // A browser that blocks storage still gets the reload below.
      }
    }

    // A full load, not a router push: this is what drops privileged content
    // from the DruxtStore and re-renders the page anonymous.
    window.location.href = window.location.origin + '/'
  })
}
