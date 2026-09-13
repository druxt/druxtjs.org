#!/usr/bin/env node
/**
 * Start the site in production.
 *
 * Holds the port with the starting page while Drupal comes up, builds the app
 * against it (the display schemas and decoupled settings are read at build
 * time), then serves pre-rendered pages first and renders the rest live.
 */
const fs = require('fs')
const http = require('http')
const path = require('path')
const { execFileSync, spawn } = require('child_process')
const { serviceRoute, waitForBackend } = require('./backend')
const { createHandler, createPageCache, crawl } = require('./page-cache')
const { createStartingHandler } = require('./starting')

const rootDir = path.join(__dirname, '..')
const env = process.env
const port = Number(env.PORT) || 3000
const host = env.HOST || '0.0.0.0'
const baseUrl = env.DRUXT_BASE_URL || 'http://nginx:8080'
const log = (message) => process.stdout.write(`start: ${message}\n`)

// What the starting page reports until the app takes the port.
const state = { phase: 'waiting', since: new Date().toISOString() }
const setPhase = (phase) => {
  state.phase = phase
  state.since = new Date().toISOString()
}

let handler = createStartingHandler(state)
const server = http.createServer((req, res) => handler(req, res))

const nuxt = (args, extraEnv) =>
  new Promise((resolve, reject) => {
    const bin = path.join(rootDir, 'node_modules', 'nuxt', 'bin', 'nuxt.js')
    const child = spawn(process.execPath, [bin, ...args], { cwd: rootDir, env: { ...env, ...extraEnv }, stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code, signal) =>
      code === 0 ? resolve() : reject(new Error(`nuxt ${args.join(' ')} exited with ${signal || code}`)),
    )
  })

const main = async () => {
  await new Promise((resolve) => server.listen(port, host, resolve))
  log(`starting page on http://${host}:${port}`)

  await waitForBackend(baseUrl, { log })
  log(`Drupal is ready at ${baseUrl}`)
  setPhase('building')

  // Canonical links and share cards name this environment's own origin.
  const origin = env.SITE_ORIGIN || env.DRUXT_FRONTEND_URL || serviceRoute(env.LAGOON_ROUTES, 'nuxt')
  if (origin) env.SITE_ORIGIN = origin.replace(/\/+$/, '')

  // The machine-readable indexes `nuxt generate` used to write, from the same corpus.
  try {
    const { readContent } = require('../lib/content-index')
    const { buildSitemap } = require('../lib/sitemap')
    const { buildLlmsTxt } = require('../lib/llms-txt')
    const docs = readContent(path.join(rootDir, 'content'))
    const siteOrigin = env.SITE_ORIGIN || 'https://druxtjs.org'
    fs.writeFileSync(path.join(rootDir, 'static', 'sitemap.xml'), buildSitemap(docs, { origin: siteOrigin }))
    fs.writeFileSync(path.join(rootDir, 'static', 'llms.txt'), buildLlmsTxt(docs, { origin: siteOrigin }))
    log(`wrote sitemap.xml and llms.txt for ${docs.length} documents`)
  } catch (error) {
    log(`sitemap.xml and llms.txt not written: ${error.message}`)
  }

  // The share cards, as `nuxt generate` writes them. A child process, because
  // satori and resvg crash when required through a patched module loader.
  try {
    const cards = execFileSync(
      process.execPath,
      [
        path.join(rootDir, 'scripts', 'og-render.js'),
        path.join(rootDir, 'content'),
        path.join(rootDir, 'assets', 'fonts'),
        path.join(rootDir, 'static', 'og'),
      ],
      { encoding: 'utf8' },
    )
    log(`rendered ${cards.trim()} share cards`)
  } catch (error) {
    log(`share cards not rendered: ${error.message}`)
  }

  const started = Date.now()
  await nuxt(['build'])
  log(`built in ${Math.round((Date.now() - started) / 1000)}s`)
  setPhase('starting')

  const { loadNuxt } = require('nuxt')
  const app = await loadNuxt({ for: 'start', rootDir })
  const cache =
    env.DOCS_CACHE === '0'
      ? null
      : createPageCache({
          dir: env.DOCS_CACHE_DIR || path.join(rootDir, '.cache', 'pages'),
          ttl: (Number(env.DOCS_CACHE_TTL) || 300) * 1000,
          render: (route) => app.server.renderRoute(route),
          log,
        })
  handler = createHandler({ cache, live: app.render, noindex: env.LAGOON_ENVIRONMENT_TYPE !== 'production' })
  log(`serving ${env.SITE_ORIGIN || `http://${host}:${port}`}`)

  if (cache) {
    const warmed = Date.now()
    const seeds = ['/', ...(await app.options.generate.routes())]
    const { stored, visited } = await crawl({ seeds, store: cache.store })
    log(`pre-rendered ${stored} of ${visited} pages in ${Math.round((Date.now() - warmed) / 1000)}s`)
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 10000).unref()
  })
}

main().catch(async (error) => {
  process.stderr.write(`start: ${error.stack || error}\n`)
  setPhase('failed')
  // Show the failure for a moment, then exit so the platform restarts us.
  const grace = Number(env.START_FAIL_GRACE || 30) * 1000
  await new Promise((resolve) => setTimeout(resolve, grace))
  process.exit(1)
})
