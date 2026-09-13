/**
 * Hard-reloads to the destination when a route's chunk fails to load.
 *
 * A tab left open across a redeploy asks for chunk URLs that no longer exist;
 * a full load of the destination gets the current build.
 *
 * @param {object} context - The Nuxt context.
 * @param {object} context.app - The root Vue app options, carrying the router.
 */
export default ({ app }) => {
  let destination = null

  app.router.beforeEach((to, from, next) => {
    destination = to.fullPath
    next()
  })

  app.router.onError((error) => {
    if (/loading chunk|chunkloaderror/i.test(String(error && error.message)) && destination) {
      window.location.assign(destination)
    }
  })
}
