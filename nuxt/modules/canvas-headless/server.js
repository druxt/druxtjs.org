/**
 * The server side of Canvas Headless: the draft session routes, the component
 * metadata endpoint Canvas registers components from, and a page route.
 *
 * Canvas's SDK core does the work. This is the adapter around it: Node's
 * request and response turned into the web ones the SDK takes.
 */
const path = require('path')
const { HEADER: WORKSPACE_HEADER, readWorkspace } = require('../../lib/workspace')

const DRAFT_FLAG = 'canvas_headless_draft_mode'

const sdk = () =>
  Promise.all([
    import('@drupal-canvas/headless/server'),
    import('@drupal-canvas/headless/components-endpoint'),
    import('@drupal-canvas/headless'),
  ]).then(([server, endpoint, core]) => ({ server, endpoint, core }))

const cookies = (req) =>
  Object.fromEntries(
    String(req.headers.cookie || '')
      .split(';')
      .map((pair) => pair.trim().split(/=(.*)/s))
      .filter(([name]) => name)
      .map(([name, value]) => [name, decodeURIComponent(value || '')])
  )

/**
 * A fetch that names a workspace on the requests that carry a session's token.
 *
 * @param {string|null} workspace - The workspace's id, or null for live.
 * @param {Function} [send] - The fetch to send with.
 * @returns {Function} A fetch.
 */
const workspaceFetch =
  (workspace, send = fetch) =>
  (url, init = {}) => {
    const headers = new Headers(init.headers)
    if (workspace && headers.has('authorization')) headers.set(WORKSPACE_HEADER, workspace)
    return send(url, { ...init, headers })
  }

const serialise = ({ name, value, httpOnly, path, sameSite, secure, partitioned, expires }) =>
  [
    `${name}=${encodeURIComponent(value)}`,
    path && `Path=${path}`,
    expires && `Expires=${expires.toUTCString()}`,
    httpOnly && 'HttpOnly',
    secure && 'Secure',
    sameSite && `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`,
    partitioned && 'Partitioned',
  ]
    .filter(Boolean)
    .join('; ')

const setCookie = (res, cookie) => {
  const existing = [].concat(res.getHeader('Set-Cookie') || [])
  res.setHeader('Set-Cookie', [...existing, serialise(cookie)])
}

const body = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

// The URL the browser asked for: behind a proxy the scheme is in a header.
const requestUrl = (req) => {
  const scheme = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
  return `${scheme}://${req.headers.host}${req.originalUrl || req.url}`
}

const webRequest = async (req) => {
  const url = requestUrl(req)
  const init = { method: req.method, headers: req.headers }
  if (!['GET', 'HEAD'].includes(req.method)) init.body = await body(req)
  return new Request(url, init)
}

const send = async (res, response) => {
  res.statusCode = response.status
  response.headers.forEach((value, name) => {
    if (name.toLowerCase() !== 'set-cookie') res.setHeader(name, value)
  })
  const set = response.headers.getSetCookie ? response.headers.getSetCookie() : []
  if (set.length) res.setHeader('Set-Cookie', [...[].concat(res.getHeader('Set-Cookie') || []), ...set])
  res.end(Buffer.from(await response.arrayBuffer()))
}

const json = (res, status, data) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

// The SDK's session element and its styles, for a page in a draft session.
// Bundled on first use: webpack 4 does not read the SDK's package exports.
const ASSETS = '/_canvas-headless'
let client
const assets = {
  '/client.js': async (res) => {
    client =
      client ||
      require('esbuild')
        .build({
          entryPoints: [path.join(__dirname, 'client-entry.mjs')],
          bundle: true,
          format: 'iife',
          target: 'es2020',
          minify: true,
          write: false,
        })
        .then((result) => result.outputFiles[0].text)
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8')
    res.end(await client)
  },
  '/preview.css': async (res) => {
    res.setHeader('Content-Type', 'text/css; charset=utf-8')
    res.end(require('fs').readFileSync(require.resolve('@drupal-canvas/headless/preview.css')))
  },
}

module.exports = ({ rootDir }) => {
  const draftServer = async (req, res) => {
    const { server } = await sdk()
    const jar = cookies(req)
    // The workspace the editor reads the site in goes with the session's own
    // requests to Drupal, so a page that exists only in a workspace is found.
    // Drupal ignores the header from anyone not signed in.
    return server.createDraftServer({
      fetchImpl: workspaceFetch(readWorkspace(req.headers.cookie)),
      adapter: {
        getRequestUrl: async () => requestUrl(req),
        getCookie: async (name) => (name in jar ? jar[name] : null),
        setCookie: async (cookie) => setCookie(res, cookie),
        isDraftFlagEnabled: async () => jar[DRAFT_FLAG] === '1',
        enableDraftFlag: async () => setCookie(res, server.buildDraftCookie(DRAFT_FLAG, '1')),
        disableDraftFlag: async () => setCookie(res, server.buildClearedDraftCookie(DRAFT_FLAG)),
        redirect: (path) => new Response(null, { status: 307, headers: { Location: path } }),
      },
    })
  }

  // The state of this request's draft session, for the session element.
  const session = async (req, res) => {
    const { core } = await sdk()
    const server = await draftServer(req, res)
    const jsonApi = await server.getJsonApiRuntimeConfig()
    const enabled = cookies(req)[DRAFT_FLAG] === '1'
    const data = enabled ? await server.getDraftData() : null
    return {
      enabled,
      tokenExpiresAt: (data && data.tokenExpiresAt) || null,
      expired: enabled && (!data || core.isDraftSessionExpired(data)),
      renewUrl: (data && data.renewUrl) || null,
      editorOrigin: enabled ? core.getDraftEditorOrigin(data) : null,
      jsonApi,
    }
  }

  // The page at a path, as the content API answers this request's session.
  const page = async (req, res, path) => {
    const { server } = await sdk()
    const found = await (await draftServer(req, res)).fetchPage(path)
    if (!found) return null
    return server.isPageRedirect(found) ? { redirect: found.redirect } : found
  }

  let metadata
  const routes = {
    'GET /api/draft': async (req, res) => send(res, await (await draftServer(req, res)).enableDraftMode(await webRequest(req))),
    'POST /api/draft/renew': async (req, res) => send(res, await (await draftServer(req, res)).renewDraftSession(await webRequest(req))),
    'POST /api/disable-draft': async (req, res) => send(res, await (await draftServer(req, res)).disableDraftMode()),
    'GET /api/draft/session': async (req, res) => json(res, 200, await session(req, res)),
    'GET /api/canvas/page': async (req, res) => {
      const path = new URL(req.originalUrl || req.url, 'http://localhost').searchParams.get('path') || '/'
      const found = await page(req, res, path)
      json(res, found ? 200 : 404, found || { error: 'not_found' })
    },
  }

  const components = async (req, res) => {
    const { endpoint } = await sdk()
    metadata =
      metadata ||
      endpoint.createComponentMetadataHandler({
        isProduction: false,
        loadManifest: async () => null,
        scanComponents: () => endpoint.buildComponentMetadataPayload({ projectRoot: rootDir }),
      })
    const request = await webRequest(req)
    if (req.method === 'OPTIONS') return send(res, await metadata.OPTIONS(request))
    if (req.method === 'GET') return send(res, await metadata.GET(request))
    res.statusCode = 405
    res.setHeader('Allow', 'GET, OPTIONS')
    res.end()
  }

  return async (req, res, next) => {
    const path = (req.originalUrl || req.url).split('?')[0].replace(/\/+$/, '') || '/'
    try {
      // Who may frame this response: the editor a live draft session names.
      const { server } = await sdk()
      const data = cookies(req)[DRAFT_FLAG] === '1' ? await (await draftServer(req, res)).getDraftData() : null
      res.setHeader('Content-Security-Policy', server.mergeFrameAncestors(null, server.resolveFrameAncestors(data)))

      if (path.startsWith(`${ASSETS}/`) && assets[path.slice(ASSETS.length)]) {
        return await assets[path.slice(ASSETS.length)](res)
      }
      if (path === '/api/canvas/components') return await components(req, res)
      const route = routes[`${req.method} ${path}`]
      if (route) return await route(req, res)
    } catch (error) {
      console.error('[canvas-headless]', error)
      return json(res, 500, { error: String((error && error.message) || error) })
    }
    // For the page's own server render, which has this request in hand.
    req.canvasHeadless = {
      load: async (route) => ({ page: await page(req, res, route), session: await session(req, res) }),
    }
    next()
  }
}

module.exports.cookies = cookies
module.exports.serialise = serialise
module.exports.workspaceFetch = workspaceFetch
