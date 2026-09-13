/**
 * Request listeners that hand a request to another server and stream the
 * answer back: the port stays open while the real server builds, and the
 * backend's paths reach Drupal from the same origin.
 */
const http = require('http')
const https = require('https')

/** The paths the browser sends to Drupal: Druxt's API, the router, files and the decoupled settings. */
const BACKEND_PATHS = ['/jsonapi', '/router', '/sites', '/_decoupled']

/**
 * Whether a request path belongs to Drupal rather than the app in front of it.
 *
 * @param {string} url - The request URL.
 * @returns {boolean} True for the backend's paths.
 */
const isBackendPath = (url) => {
  const path = String(url || '').split('?')[0]
  return BACKEND_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/**
 * @param {string} target - The server to hand requests to, as an origin such as `http://127.0.0.1:3001`.
 * @param {object} [options] - Options.
 * @param {boolean} [options.keepHost] - Send the browser's Host header on, so the answer's links keep this origin.
 * @returns {Function} A request listener.
 */
const createProxyHandler = (target, { keepHost = false } = {}) => {
  const origin = new URL(target)
  const client = origin.protocol === 'https:' ? https : http
  return (req, res) => {
    const headers = { ...req.headers, host: keepHost ? req.headers.host : origin.host }
    const upstream = client.request(
      { host: origin.hostname, port: origin.port || (origin.protocol === 'https:' ? 443 : 80), method: req.method, path: req.url, headers },
      (answer) => {
        res.writeHead(answer.statusCode, answer.headers)
        answer.pipe(res)
      },
    )
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end('Bad Gateway')
    })
    req.pipe(upstream)
  }
}

module.exports = { BACKEND_PATHS, createProxyHandler, isBackendPath }
