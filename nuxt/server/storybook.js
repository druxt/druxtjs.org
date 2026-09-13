/**
 * Starts Storybook behind the starting page. Druxt writes a story per
 * display, block, menu and view from the backend, so Drupal has to answer
 * first, and Storybook's own build takes minutes; the port is held from the
 * start so the deployment counts as up, and requests go through once
 * Storybook answers.
 *
 *   node server/storybook.js
 */
const http = require('http')
const path = require('path')
const { spawn } = require('child_process')
const { waitForBackend } = require('./backend')
const { createProxyHandler, isBackendPath } = require('./proxy')
const { createStartingHandler } = require('./starting')

const env = process.env
const port = Number(env.PORT) || 3000
const host = env.HOST || '0.0.0.0'
const inner = port + 1
const baseUrl = env.DRUXT_BASE_URL || 'http://nginx:8080'
const log = (message) => process.stdout.write(`storybook: ${message}\n`)

const state = { phase: 'waiting', since: new Date().toISOString() }
const setPhase = (phase) => {
  state.phase = phase
  state.since = new Date().toISOString()
}
// Drupal's paths go to Drupal from this origin, as they do on the site, and
// under Drupal's own host: this one is not among the hosts it trusts.
const backend = createProxyHandler(baseUrl)
let handler = createStartingHandler(state)
const server = http.createServer((req, res) => (isBackendPath(req.url) ? backend : handler)(req, res))

/** Resolves once Storybook answers on its own port. */
const waitForStorybook = async () => {
  while (true) {
    const up = await new Promise((resolve) => {
      http
        .get({ host: '127.0.0.1', port: inner, path: '/iframe.html' }, (res) => {
          res.resume()
          resolve(res.statusCode === 200)
        })
        .on('error', () => resolve(false))
    })
    if (up) return
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

const main = async () => {
  await new Promise((resolve) => server.listen(port, host, resolve))
  log(`starting page on http://${host}:${port}`)
  await waitForBackend(baseUrl, { log })
  log(`Drupal is ready at ${baseUrl}`)
  setPhase('building')

  // `nuxt storybook` hands over to this binary, and finds it only on yarn's PATH.
  const bin = path.join(__dirname, '..', 'node_modules', '@nuxtjs', 'storybook', 'bin', 'nuxt-storybook.js')
  const child = spawn(process.execPath, [bin, '--port', String(inner), '--host', '127.0.0.1', '--ci'], {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: 'inherit',
  })
  child.on('exit', (code, signal) => {
    log(`Storybook exited with ${signal || code}`)
    setPhase('failed')
    process.exit(1)
  })

  await waitForStorybook()
  setPhase('starting')
  handler = createProxyHandler(`http://127.0.0.1:${inner}`)
  log(`serving Storybook from port ${inner}`)
}

main().catch((error) => {
  console.error(error)
  setPhase('failed')
  process.exit(1)
})
